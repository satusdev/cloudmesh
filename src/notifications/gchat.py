from datetime import datetime
import requests
from src.core.matcher import get_domain_expiry, get_days_to_expiry

def send_google_chat_notifications(unique_domains, total_a_records, matched_server_ips, ip_to_server, webhook_url):
    if not webhook_url:
        return

    total_servers = len(matched_server_ips)
    total_spending = sum(ip_to_server[ip]['price_monthly'] for ip in matched_server_ips if ip in ip_to_server)

    expiring = []
    for domain in unique_domains:
        expiry_str = get_domain_expiry(domain)
        days = get_days_to_expiry(expiry_str)
        if days is not None and days <= 30:
            expiring.append((domain, expiry_str, days))

    widgets = [
        {
            "textParagraph": {
                "text": (
                    f"• <b>Total Domains:</b> {len(unique_domains)}<br/>"
                    f"• <b>Total A Records:</b> {total_a_records}<br/>"
                    f"• <b>Matched Servers:</b> {total_servers}<br/>"
                    f"• <b>Monthly Spending:</b> €{total_spending:.2f}"
                )
            }
        }
    ]

    sections = [
        {
            "header": "📊 Infrastructure Summary",
            "widgets": widgets
        }
    ]

    if expiring:
        expiring_text_lines = []
        for domain, exp_date, days_left in sorted(expiring, key=lambda x: x[2]):
            if days_left < 0:
                status = f"<font color='#ff4d4d'><b>EXPIRED</b> ({abs(days_left)} days ago)</font>"
            elif days_left == 0:
                status = "<font color='#ff9900'><b>EXPIRES TODAY</b></font>"
            else:
                status = f"in <b>{days_left} days</b>"
            expiring_text_lines.append(f"⚠️ <b>{domain}</b> — expires {exp_date} ({status})")

        sections.append({
            "header": "⚠️ Expiring Domains Alert",
            "widgets": [
                {
                    "textParagraph": {
                        "text": "<br/>".join(expiring_text_lines)
                    }
                }
            ]
        })
    else:
        sections.append({
            "header": "✅ Domain Expirations",
            "widgets": [
                {
                    "textParagraph": {
                        "text": "All domains are healthy and not expiring within the next 30 days."
                    }
                }
            ]
        })

    payload = {
        "cardsV2": [
            {
                "cardId": "cloudmesh_dashboard_summary",
                "card": {
                    "header": {
                        "title": "CloudMesh Audit Report",
                        "subtitle": f"Execution Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                        "imageUrl": "https://img.icons8.com/fluency/96/000000/server.png",
                        "imageType": "CIRCLE"
                    },
                    "sections": sections
                }
            }
        ]
    }

    try:
        headers = {"Content-Type": "application/json; charset=UTF-8"}
        response = requests.post(webhook_url, json=payload, headers=headers)
        if response.status_code != 200:
            print(f"Failed to send message to Google Chat. Status code: {response.status_code}")
            print(response.text)
        else:
            print("Google Chat notification sent successfully.")
    except Exception as e:
        print(f"Error sending Google Chat notification: {e}")
