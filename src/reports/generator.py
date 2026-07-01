import json
import os
from datetime import datetime
import pdfkit
from src.core.matcher import get_domain_expiry, get_days_to_expiry
from src.config import get_dashboard_password_hash


def generate_html_dashboard(mapping_by_domain, unique_domains, total_a_records, matched_server_ips, ip_to_server):
    total_servers = len(matched_server_ips)
    total_spending = sum(ip_to_server[ip]['price_monthly'] for ip in matched_server_ips if ip in ip_to_server)
    match_rate = (total_servers / total_a_records * 100) if total_a_records > 0 else 0
    unmatched_count = total_a_records - total_servers

    domains_html = []
    for domain in sorted(mapping_by_domain.keys()):
        expiry_date = get_domain_expiry(domain)
        days_left = get_days_to_expiry(expiry_date)
        
        if days_left is not None:
            if days_left < 0:
                expiry_class = "danger"
                expiry_label = f"EXPIRED ({abs(days_left)} days ago)"
            elif days_left <= 30:
                expiry_class = "warning"
                expiry_label = f"Expiring in {days_left} days"
            else:
                expiry_class = "healthy"
                expiry_label = f"Expires {expiry_date}"
        else:
            expiry_class = "healthy"
            expiry_label = f"Expires: {expiry_date}"

        num_records = len(mapping_by_domain[domain])
        
        table_rows = []
        sorted_items = sorted(mapping_by_domain[domain], key=lambda x: x['subdomain'])
        for item in sorted_items:
            is_matched = item['server_name'] != 'No match'
            row_class = "matched-row" if is_matched else "unmatched-row"
            created_date = datetime.fromisoformat(item['created'].replace('Z', '+00:00')).strftime('%Y-%m-%d') if item['created'] != 'N/A' else 'N/A'
            price = f"€{item['price_monthly']:.2f}" if is_matched else 'N/A'
            traffic = f"{item['traffic_mb']} MB" if is_matched else 'N/A'
            
            if not is_matched:
                status_badge = '<span class="badge-status no-match">● No Match</span>'
            elif item['status'] == 'running':
                status_badge = '<span class="badge-status running">● Running</span>'
            else:
                status_badge = f'<span class="badge-status off">● {item["status"].capitalize()}</span>'

            table_rows.append(f"""
            <tr class="{row_class}">
                <td style="font-weight: 600;">{item['subdomain']}</td>
                <td style="font-family: monospace; color: var(--accent-indigo);">{item['ip']}</td>
                <td>{item['project']}</td>
                <td>{item['server_name']}</td>
                <td>{status_badge}</td>
                <td>{created_date}</td>
                <td><span style="font-family: monospace; background: rgba(255,255,255,0.03); padding: 2px 6px; border-radius: 4px;">{item['server_type']}</span></td>
                <td class="text-price">{price}</td>
                <td>{traffic}</td>
                <td style="font-size: 0.8rem; color: var(--text-muted);">{item['labels']}</td>
            </tr>
            """)
        
        table_rows_str = "\n".join(table_rows)
        
        domains_html.append(f"""
        <div class="domain-card">
            <div class="domain-card-header" onclick="toggleCollapse(this)">
                <div class="domain-title-group">
                    <span class="chevron-icon">▼</span>
                    <span class="domain-name">{domain}</span>
                    <span class="domain-badge">{num_records} A records</span>
                </div>
                <div class="domain-expiry-info">
                    <span class="expiry-tag {expiry_class}">{expiry_label}</span>
                </div>
            </div>
            <div class="domain-card-content">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>Subdomain</th>
                            <th>IP Address</th>
                            <th>Hetzner Project</th>
                            <th>Server Name</th>
                            <th>Status</th>
                            <th>Created Date</th>
                            <th>Type</th>
                            <th>Price / Mo</th>
                            <th>Traffic Limit</th>
                            <th>Labels</th>
                        </tr>
                    </thead>
                    <tbody>
                        {table_rows_str}
                    </tbody>
                </table>
            </div>
        </div>
        """)

    domains_html_str = "\n".join(domains_html)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CloudMesh Premium Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-main: #0b0f19;
            --bg-card: #151f32;
            --bg-card-header: #1e293b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --accent-indigo: #6366f1;
            --accent-emerald: #10b981;
            --accent-rose: #ef4444;
            --accent-amber: #f59e0b;
            --border-color: rgba(255, 255, 255, 0.06);
        }}
        body {{
            background-color: var(--bg-main);
            color: var(--text-main);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 2rem;
            -webkit-font-smoothing: antialiased;
        }}
        .dashboard-container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        .dashboard-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 1.5rem;
            margin-bottom: 2rem;
        }}
        .dashboard-title {{
            display: flex;
            align-items: center;
            gap: 1rem;
        }}
        .dashboard-title img {{
            width: 48px;
            height: 48px;
        }}
        .dashboard-title h1 {{
            margin: 0;
            font-size: 2rem;
            font-weight: 800;
            letter-spacing: -0.05em;
            background: linear-gradient(135deg, #a5b4fc, #6366f1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}
        .timestamp {{
            color: var(--text-muted);
            font-size: 0.875rem;
            text-align: right;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2.5rem;
        }}
        .stat-card {{
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            position: relative;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }}
        .stat-card:hover {{
            transform: translateY(-4px);
            border-color: rgba(99, 102, 241, 0.4);
            box-shadow: 0 10px 20px -10px rgba(99, 102, 241, 0.2);
        }}
        .stat-label {{
            color: var(--text-muted);
            font-size: 0.875rem;
            font-weight: 500;
            margin-bottom: 0.5rem;
        }}
        .stat-value {{
            font-size: 2.25rem;
            font-weight: 800;
            letter-spacing: -0.03em;
        }}
        .stat-card.spend .stat-value {{
            color: #a5b4fc;
        }}
        .stat-card.match .stat-value {{
            color: var(--accent-emerald);
        }}
        .progress-bar-container {{
            height: 6px;
            background-color: rgba(255,255,255,0.05);
            border-radius: 4px;
            margin-top: 0.75rem;
            overflow: hidden;
        }}
        .progress-bar-fill {{
            height: 100%;
            background: linear-gradient(90deg, #10b981, #34d399);
        }}
        .controls-bar {{
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            margin-bottom: 2rem;
            background: rgba(255,255,255,0.01);
            padding: 1rem;
            border-radius: 12px;
            border: 1px solid var(--border-color);
        }}
        .search-wrapper {{
            position: relative;
            flex: 1;
            min-width: 300px;
        }}
        .search-input {{
            width: 100%;
            background-color: rgba(0,0,0,0.25);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 0.75rem 1rem;
            color: var(--text-main);
            font-size: 0.95rem;
            box-sizing: border-box;
            transition: all 0.2s;
        }}
        .search-input:focus {{
            outline: none;
            border-color: var(--accent-indigo);
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
        }}
        .filter-tabs {{
            display: flex;
            gap: 0.5rem;
        }}
        .filter-tab {{
            background-color: rgba(255,255,255,0.03);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 0.5rem 1rem;
            color: var(--text-muted);
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 600;
            transition: all 0.2s;
        }}
        .filter-tab:hover {{
            background-color: rgba(255,255,255,0.06);
            color: var(--text-main);
        }}
        .filter-tab.active {{
            background-color: var(--accent-indigo);
            border-color: var(--accent-indigo);
            color: white;
        }}
        .action-buttons {{
            display: flex;
            gap: 0.5rem;
        }}
        .btn {{
            background-color: transparent;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 0.5rem 1rem;
            color: var(--text-muted);
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 500;
            transition: all 0.2s;
        }}
        .btn:hover {{
            color: var(--text-main);
            background-color: rgba(255,255,255,0.05);
        }}
        .domain-card {{
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            margin-bottom: 1.5rem;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
            transition: border-color 0.2s;
        }}
        .domain-card:hover {{
            border-color: rgba(255,255,255,0.12);
        }}
        .domain-card-header {{
            background-color: rgba(255, 255, 255, 0.015);
            border-bottom: 1px solid var(--border-color);
            padding: 1.25rem 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
            transition: background-color 0.2s;
        }}
        .domain-card-header:hover {{
            background-color: rgba(255, 255, 255, 0.03);
        }}
        .domain-title-group {{
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }}
        .domain-name {{
            font-size: 1.2rem;
            font-weight: 700;
            letter-spacing: -0.02em;
        }}
        .domain-badge {{
            background-color: rgba(99, 102, 241, 0.15);
            color: #c7d2fe;
            font-size: 0.75rem;
            font-weight: 600;
            padding: 0.2rem 0.6rem;
            border-radius: 100px;
        }}
        .domain-expiry-info {{
            display: flex;
            align-items: center;
            gap: 1rem;
        }}
        .expiry-tag {{
            font-size: 0.75rem;
            padding: 0.25rem 0.75rem;
            border-radius: 6px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.02em;
        }}
        .expiry-tag.healthy {{
            background-color: rgba(16, 185, 129, 0.1);
            color: #a7f3d0;
            border: 1px solid rgba(16, 185, 129, 0.15);
        }}
        .expiry-tag.warning {{
            background-color: rgba(245, 158, 11, 0.1);
            color: #fde68a;
            border: 1px solid rgba(245, 158, 11, 0.15);
        }}
        .expiry-tag.danger {{
            background-color: rgba(244, 63, 94, 0.1);
            color: #fecdd3;
            border: 1px solid rgba(244, 63, 94, 0.15);
        }}
        .chevron-icon {{
            transition: transform 0.2s ease;
            color: var(--text-muted);
            font-size: 0.8rem;
        }}
        .domain-card.collapsed .chevron-icon {{
            transform: rotate(-90deg);
        }}
        .domain-card-content {{
            padding: 1.5rem;
            overflow-x: auto;
        }}
        .domain-card.collapsed .domain-card-content {{
            display: none;
        }}
        table.premium-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
        }}
        table.premium-table th {{
            background-color: rgba(255,255,255,0.005);
            color: var(--text-muted);
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.7rem;
            letter-spacing: 0.05em;
            padding: 0.875rem 0.75rem;
            border-bottom: 1px solid var(--border-color);
            text-align: left;
        }}
        table.premium-table td {{
            padding: 0.875rem 0.75rem;
            border-bottom: 1px solid rgba(255,255,255,0.02);
            color: var(--text-main);
        }}
        table.premium-table tr:last-child td {{
            border-bottom: none;
        }}
        table.premium-table tr {{
            transition: background-color 0.15s;
        }}
        table.premium-table tr:hover {{
            background-color: rgba(255,255,255,0.015);
        }}
        .badge-status {{
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
            font-size: 0.75rem;
            font-weight: 600;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
        }}
        .badge-status.running {{
            background-color: rgba(16, 185, 129, 0.15);
            color: #a7f3d0;
        }}
        .badge-status.no-match {{
            background-color: rgba(244, 63, 94, 0.15);
            color: #fecdd3;
        }}
        .badge-status.off {{
            background-color: rgba(107, 114, 128, 0.15);
            color: #e5e7eb;
        }}
        .text-price {{
            font-family: monospace;
            font-weight: 600;
            color: #a5b4fc;
        }}
        .no-results-message {{
            text-align: center;
            color: var(--text-muted);
            padding: 4rem 0;
            display: none;
            font-size: 1.1rem;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 12px;
        }}
    </style>
</head>
<body>
    <div class="dashboard-container">
        <header class="dashboard-header">
            <div class="dashboard-title">
                <img src="https://img.icons8.com/fluency/96/000000/server.png" alt="CloudMesh Logo"/>
                <div>
                     <h1>CloudMesh</h1>
                     <span style="color: var(--text-muted); font-size: 0.85rem;">Infrastructure Domain Mapping & Cost Audits</span>
                </div>
            </div>
            <div class="timestamp">
                <div>SYSTEM AUDIT REPORT</div>
                <div style="font-weight: 600; color: var(--text-main);">{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</div>
            </div>
        </header>

        <section class="stats-grid">
            <div class="stat-card">
                <span class="stat-label">TOTAL DOMAINS</span>
                <span class="stat-value">{len(unique_domains)}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">TOTAL A RECORDS</span>
                <span class="stat-value">{total_a_records}</span>
            </div>
            <div class="stat-card match">
                <span class="stat-label">MATCHED SERVERS</span>
                <span class="stat-value">{total_servers} <span style="font-size: 1.1rem; font-weight: 500; color: var(--text-muted);">/ {total_a_records}</span></span>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: {match_rate:.1f}%;"></div>
                </div>
                <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; text-align: right;">{match_rate:.1f}% Match Rate</span>
            </div>
            <div class="stat-card spend">
                <span class="stat-label">EST. MONTHLY SPEND</span>
                <span class="stat-value">€{total_spending:.2f}</span>
            </div>
        </section>

        <section class="controls-bar">
            <div class="search-wrapper">
                <input type="text" id="search-input" class="search-input" placeholder="Search by domain, subdomain, IP, server, or project..." oninput="filterTable()">
            </div>
            <div class="filter-tabs">
                <div class="filter-tab active" data-filter="all" onclick="setFilter(this)">All Records</div>
                <div class="filter-tab" data-filter="matched" onclick="setFilter(this)">Matched Only</div>
                <div class="filter-tab" data-filter="unmatched" onclick="setFilter(this)">Orphaned / Unmatched ({unmatched_count})</div>
            </div>
            <div class="action-buttons">
                <button class="btn" onclick="setAllCollapse(false)">Expand All</button>
                <button class="btn" onclick="setAllCollapse(true)">Collapse All</button>
            </div>
        </section>

        <div id="no-results-msg" class="no-results-message">
            <div style="font-size: 2.5rem; margin-bottom: 1rem;">🔍</div>
            No mapping records found matching your filters.
        </div>

        <section>
            {domains_html_str}
        </section>
    </div>

    <script>
        function filterTable() {{
            const query = document.getElementById('search-input').value.toLowerCase();
            const activeTab = document.querySelector('.filter-tab.active').getAttribute('data-filter');
            const cards = document.querySelectorAll('.domain-card');
            let overallVisibleCount = 0;

            cards.forEach(card => {{
                const rows = card.querySelectorAll('tbody tr');
                let cardVisibleCount = 0;

                rows.forEach(row => {{
                    const subdomain = row.cells[0].textContent.toLowerCase();
                    const ip = row.cells[1].textContent.toLowerCase();
                    const project = row.cells[2].textContent.toLowerCase();
                    const serverName = row.cells[3].textContent.toLowerCase();
                    
                    const isMatched = !row.classList.contains('unmatched-row');
                    
                    const matchesText = subdomain.includes(query) || ip.includes(query) || project.includes(query) || serverName.includes(query);
                    
                    let matchesTab = true;
                    if (activeTab === 'matched') {{
                        matchesTab = isMatched;
                    }} else if (activeTab === 'unmatched') {{
                        matchesTab = !isMatched;
                    }}

                    if (matchesText && matchesTab) {{
                        row.style.display = '';
                        cardVisibleCount++;
                    }} else {{
                        row.style.display = 'none';
                    }}
                }});

                if (cardVisibleCount > 0) {{
                    card.style.display = '';
                    overallVisibleCount++;
                    const badge = card.querySelector('.domain-badge');
                    if (badge) {{
                        badge.textContent = cardVisibleCount + ' records';
                    }}
                }} else {{
                    card.style.display = 'none';
                }}
            }});

            const noResults = document.getElementById('no-results-msg');
            if (overallVisibleCount === 0) {{
                noResults.style.display = 'block';
            }} else {{
                noResults.style.display = 'none';
            }}
        }}

        function setFilter(element) {{
            document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
            element.classList.add('active');
            filterTable();
        }}

        function toggleCollapse(header) {{
            const card = header.closest('.domain-card');
            card.classList.toggle('collapsed');
        }}

        function setAllCollapse(collapsed) {{
            document.querySelectorAll('.domain-card').forEach(card => {{
                if (collapsed) {{
                    card.classList.add('collapsed');
                }} else {{
                    card.classList.remove('collapsed');
                }}
            }});
        }}
    </script>
</body>
</html>
"""
    return html

def generate_print_html(mapping_by_domain, unique_domains, total_a_records, matched_server_ips, ip_to_server):
    total_servers = len(matched_server_ips)
    total_spending = sum(ip_to_server[ip]['price_monthly'] for ip in matched_server_ips if ip in ip_to_server)

    html = f"""
    <html>
    <head>
        <title>Domain to Server Mapping (Print View)</title>
        <style>
            body {{ font-family: Arial, sans-serif; font-size: 11px; color: #333; }}
            h1, h2 {{ color: #111; margin-top: 15px; margin-bottom: 5px; }}
            h1 {{ font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 5px; }}
            h2 {{ font-size: 14px; border-bottom: 1px solid #666; padding-bottom: 3px; }}
            table {{ border-collapse: collapse; width: 100%; margin-bottom: 15px; }}
            th, td {{ border: 1px solid #999; padding: 5px; text-align: left; }}
            th {{ background-color: #eee; font-weight: bold; }}
            .no-match {{ background-color: #ffe6e6; }}
            .summary-table {{ width: auto; min-width: 300px; margin-bottom: 20px; }}
            .summary-table td {{ padding: 6px 12px; }}
            .expiry {{ color: #666; font-size: 0.85em; font-weight: normal; }}
        </style>
    </head>
    <body>
    <h1>CloudMesh Infrastructure Audit Report</h1>
    <p>Generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</p>
    
    <h2>Summary Statistics</h2>
    <table class="summary-table">
        <tr><td><strong>Total Domains</strong></td><td>{len(unique_domains)}</td></tr>
        <tr><td><strong>Total A Records</strong></td><td>{total_a_records}</td></tr>
        <tr><td><strong>Total Matched Servers</strong></td><td>{total_servers}</td></tr>
        <tr><td><strong>Total Monthly Spending</strong></td><td>€{total_spending:.2f}</td></tr>
    </table>
    
    <p><em>Note: Highlighted rows indicate A records with IP addresses that do not map to any active Hetzner server.</em></p>
    """

    for domain in sorted(mapping_by_domain.keys()):
        expiry_date = get_domain_expiry(domain)
        num_records = len(mapping_by_domain[domain])
        html += f"""
        <h2>Domain: {domain} <span class="expiry">(Expires: {expiry_date} | {num_records} A records)</span></h2>
        <table>
        <thead>
        <tr>
            <th>Subdomain</th>
            <th>IP</th>
            <th>Project</th>
            <th>Server Name</th>
            <th>Status</th>
            <th>Created</th>
            <th>Server Type</th>
            <th>Price (€/mo)</th>
            <th>Traffic (MB)</th>
            <th>Labels</th>
        </tr>
        </thead>
        <tbody>
        """
        sorted_items = sorted(mapping_by_domain[domain], key=lambda x: x['subdomain'])
        for item in sorted_items:
            row_class = ' class="no-match"' if item['server_name'] == 'No match' else ''
            created_date = datetime.fromisoformat(item['created'].replace('Z', '+00:00')).strftime('%Y-%m-%d') if item['created'] != 'N/A' else 'N/A'
            price = f"€{item['price_monthly']:.2f}" if item['server_name'] != 'No match' else 'N/A'
            traffic = item['traffic_mb'] if item['server_name'] != 'No match' else 'N/A'
            html += f"<tr{row_class}>"
            html += f"<td>{item['subdomain']}</td>"
            html += f"<td>{item['ip']}</td>"
            html += f"<td>{item['project']}</td>"
            html += f"<td>{item['server_name']}</td>"
            html += f"<td>{item['status']}</td>"
            html += f"<td>{created_date}</td>"
            html += f"<td>{item['server_type']}</td>"
            html += f"<td>{price}</td>"
            html += f"<td>{traffic}</td>"
            html += f"<td>{item['labels']}</td>"
            html += "</tr>"
        html += "</tbody></table>"

    html += "</tbody></table>"
    return html

def save_reports(html_dashboard, html_print, timestamp, mapping_by_domain, unique_domains, total_a_records, matched_server_ips, ip_to_server, unmapped_servers, diff, recommendations, port_audit_results, security_alerts, cleanup_flags):
    os.makedirs('reports', exist_ok=True)
    snapshots_dir = os.path.join('reports', 'snapshots')
    os.makedirs(snapshots_dir, exist_ok=True)

    html_file = 'reports/mapping.html'
    pdf_file = f'reports/mapping_{timestamp}.pdf'

    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html_dashboard)
    print(f"Interactive HTML dashboard generated: {html_file}")

    total_servers = len(matched_server_ips)
    total_spending = sum(ip_to_server[ip]['price_monthly'] for ip in matched_server_ips if ip in ip_to_server)
    
    domain_expirations = {}
    for domain in unique_domains:
        exp_str = get_domain_expiry(domain)
        days = get_days_to_expiry(exp_str)
        domain_expirations[domain] = {
            "expiry_date": exp_str,
            "days_left": days
        }

    # Save snapshot first in reports/snapshots/
    snapshot_payload = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_domains": len(unique_domains),
        "total_a_records": total_a_records,
        "matched_servers": total_servers,
        "total_spending": total_spending,
        "mapping_by_domain": mapping_by_domain,
        "domain_expirations": domain_expirations,
        "servers": list(ip_to_server.values()),
        "unmapped_servers": unmapped_servers,
        "recommendations": recommendations,
        "port_audit_results": port_audit_results,
        "security_alerts": security_alerts,
        "cleanup_flags": cleanup_flags,
        "passcode_hash": get_dashboard_password_hash()
    }

    snapshot_file = os.path.join(snapshots_dir, f"snapshot_{timestamp}.json")
    try:
        with open(snapshot_file, 'w', encoding='utf-8') as f:
            json.dump(snapshot_payload, f, indent=2, ensure_ascii=False)
        print(f"Historical snapshot saved: {snapshot_file}")
    except Exception as e:
        print(f"Failed to save snapshot: {e}")

    # Save snapshot to frontend/public/snapshots/
    react_snapshots_dir = os.path.join('frontend', 'public', 'snapshots')
    os.makedirs(react_snapshots_dir, exist_ok=True)
    react_snapshot_file = os.path.join(react_snapshots_dir, f"snapshot_{timestamp}.json")
    try:
        with open(react_snapshot_file, 'w', encoding='utf-8') as f:
            json.dump(snapshot_payload, f, indent=2, ensure_ascii=False)
        print(f"React historical snapshot saved: {react_snapshot_file}")
    except Exception as e:
        print(f"Failed to save React snapshot: {e}")

    # Also save snapshot to frontend/dist/snapshots/ if dist exists (production build)
    prod_snapshots_dir = os.path.join('frontend', 'dist', 'snapshots')
    if os.path.exists(os.path.join('frontend', 'dist')):
        os.makedirs(prod_snapshots_dir, exist_ok=True)
        prod_snapshot_file = os.path.join(prod_snapshots_dir, f"snapshot_{timestamp}.json")
        try:
            with open(prod_snapshot_file, 'w', encoding='utf-8') as f:
                json.dump(snapshot_payload, f, indent=2, ensure_ascii=False)
            print(f"Production build historical snapshot saved: {prod_snapshot_file}")
        except Exception as e:
            print(f"Failed to save production build snapshot: {e}")

    # Prune old historical snapshots in backend
    from src.config import get_max_snapshots
    max_snapshots = get_max_snapshots()
    import glob
    
    snapshot_files = glob.glob(os.path.join(snapshots_dir, 'snapshot_*.json'))
    snapshot_files.sort()
    while len(snapshot_files) > max_snapshots:
        file_to_remove = snapshot_files.pop(0)
        try:
            os.remove(file_to_remove)
            print(f"Pruned old backend snapshot: {file_to_remove}")
        except Exception as e:
            print(f"Failed to prune old backend snapshot {file_to_remove}: {e}")

    # Prune old historical snapshots in frontend/public/snapshots/
    react_snapshot_files = glob.glob(os.path.join(react_snapshots_dir, 'snapshot_*.json'))
    react_snapshot_files.sort()
    while len(react_snapshot_files) > max_snapshots:
        file_to_remove = react_snapshot_files.pop(0)
        try:
            os.remove(file_to_remove)
            print(f"Pruned old React snapshot: {file_to_remove}")
        except Exception as e:
            print(f"Failed to prune old React snapshot {file_to_remove}: {e}")

    # Prune old historical snapshots in frontend/dist/snapshots/
    if os.path.exists(prod_snapshots_dir):
        prod_snapshot_files = glob.glob(os.path.join(prod_snapshots_dir, 'snapshot_*.json'))
        prod_snapshot_files.sort()
        while len(prod_snapshot_files) > max_snapshots:
            file_to_remove = prod_snapshot_files.pop(0)
            try:
                os.remove(file_to_remove)
                print(f"Pruned old production build snapshot: {file_to_remove}")
            except Exception as e:
                print(f"Failed to prune old production build snapshot {file_to_remove}: {e}")

    # Build history trends from remaining snapshots
    history_trends = []
    snapshot_files = glob.glob(os.path.join(snapshots_dir, 'snapshot_*.json'))
    snapshot_files.sort()
    for s_file in snapshot_files:
        try:
            with open(s_file, 'r', encoding='utf-8') as f:
                s_data = json.load(f)
                history_trends.append({
                    "timestamp": s_data.get("timestamp"),
                    "total_spending": s_data.get("total_spending"),
                    "total_a_records": s_data.get("total_a_records"),
                    "matched_servers": s_data.get("matched_servers"),
                    "total_domains": s_data.get("total_domains")
                })
        except Exception:
            pass

    # Build snapshots list for dropdown
    snapshots_list = []
    for s_file in snapshot_files:
        filename = os.path.basename(s_file)
        try:
            with open(s_file, 'r', encoding='utf-8') as f:
                s_data = json.load(f)
                snapshots_list.append({
                    "filename": filename,
                    "timestamp": s_data.get("timestamp")
                })
        except Exception:
            pass
    snapshots_list.sort(key=lambda x: x['timestamp'], reverse=True)

    # Compile the final data payload
    data_payload = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_domains": len(unique_domains),
        "total_a_records": total_a_records,
        "matched_servers": total_servers,
        "total_spending": total_spending,
        "mapping_by_domain": mapping_by_domain,
        "domain_expirations": domain_expirations,
        "servers": list(ip_to_server.values()),
        "unmapped_servers": unmapped_servers,
        "diff": diff,
        "history_trends": history_trends,
        "recommendations": recommendations,
        "port_audit_results": port_audit_results,
        "security_alerts": security_alerts,
        "cleanup_flags": cleanup_flags,
        "snapshots_list": snapshots_list,
        "passcode_hash": get_dashboard_password_hash()
    }

    # Save to reports/data.json
    json_path = 'reports/data.json'
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data_payload, f, indent=2, ensure_ascii=False)
    print(f"JSON data report generated: {json_path}")

    # Also attempt to save directly to the React public directory if it exists
    react_public_dir = os.path.join('frontend', 'public')
    if os.path.exists(react_public_dir):
        react_json_path = os.path.join(react_public_dir, 'data.json')
        try:
            with open(react_json_path, 'w', encoding='utf-8') as f:
                json.dump(data_payload, f, indent=2, ensure_ascii=False)
            print(f"React dashboard JSON updated at: {react_json_path}")
        except Exception as e:
            print(f"Failed to update React public JSON: {e}")

    # Also save to React dist directory if it exists
    react_dist_dir = os.path.join('frontend', 'dist')
    if os.path.exists(react_dist_dir):
        react_dist_json_path = os.path.join(react_dist_dir, 'data.json')
        try:
            with open(react_dist_json_path, 'w', encoding='utf-8') as f:
                json.dump(data_payload, f, indent=2, ensure_ascii=False)
            print(f"React production build JSON updated at: {react_dist_json_path}")
        except Exception as e:
            print(f"Failed to update React dist JSON: {e}")

    print_html_file = 'reports/mapping_print.tmp.html'
    try:
        with open(print_html_file, 'w', encoding='utf-8') as f:
            f.write(html_print)
        pdfkit.from_file(print_html_file, pdf_file)
        print(f"PDF report generated: {pdf_file}")
    except Exception as e:
        print(f"Error generating PDF: {e}")
        print("HTML dashboard still available at reports/mapping.html")
    finally:
        if os.path.exists(print_html_file):
            try:
                os.remove(print_html_file)
            except Exception:
                pass

    return pdf_file