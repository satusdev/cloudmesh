import cProfile
import os
import pstats
import time
from datetime import datetime
from prometheus_client import push_to_gateway

from src.config import (
    get_cloudflare_token,
    get_hetzner_projects,
    get_pushgateway_url,
    get_bool_env
)
from src.core.matcher import process_servers_and_domains
from src.metrics import setup_prometheus_metrics
from src.notifications.gchat import send_google_chat_notifications
from src.notifications.slack import (
    upload_to_slack,
    send_message_to_slack,
    send_expiring_domains_warning
)
from src.reports.generator import (
    generate_html_dashboard,
    generate_print_html,
    save_reports
)

def dispatch_notifications(pdf_file, unique_domains, total_a_records, matched_server_ips, ip_to_server):
    enable_slack = get_bool_env("ENABLE_SLACK_NOTIFICATIONS", True)
    enable_gchat = get_bool_env("ENABLE_GOOGLE_CHAT_NOTIFICATIONS", True)
    
    slack_bot_token = os.environ.get("SLACK_BOT_TOKEN")
    slack_channel_id = os.environ.get("SLACK_CHANNEL_ID")
    gchat_webhook_url = os.environ.get("GOOGLE_CHAT_WEBHOOK_URL")

    if enable_slack and slack_bot_token and slack_channel_id:
        try:
            print("Dispatching Slack notifications...")
            initial_comment = "CloudMesh Weekly Report - Server and Cloudflare monitoring (PDF)"
            upload_result = upload_to_slack(pdf_file, slack_bot_token, slack_channel_id, initial_comment)
            if upload_result.get("ok"):
                print("PDF report uploaded to Slack successfully.")
                file_name = os.path.basename(pdf_file)
                send_message_to_slack(
                    slack_bot_token,
                    slack_channel_id,
                    f"CloudMesh Weekly Report (PDF) uploaded: {file_name}"
                )
            send_expiring_domains_warning(unique_domains, slack_bot_token, slack_channel_id)
        except Exception as e:
            print(f"Error executing Slack notifications: {e}")
    else:
        if not enable_slack:
            print("Slack notifications disabled via configuration.")
        elif not (slack_bot_token and slack_channel_id):
            print("Slack notification credentials missing.")

    if enable_gchat and gchat_webhook_url:
        try:
            print("Dispatching Google Chat notifications...")
            send_google_chat_notifications(
                unique_domains, 
                total_a_records, 
                matched_server_ips, 
                ip_to_server, 
                gchat_webhook_url
            )
        except Exception as e:
            print(f"Error executing Google Chat notifications: {e}")
    else:
        if not enable_gchat:
            print("Google Chat notifications disabled via configuration.")
        elif not gchat_webhook_url:
            print("Google Chat webhook URL missing.")

def run_audit():
    profiler = cProfile.Profile()
    profiler.enable()

    registry, metrics = setup_prometheus_metrics()
    start_time = time.time()
    error_occurred = False
    pushgateway_url = None

    try:
        cloudflare_token = get_cloudflare_token()
        hetzner_projects = get_hetzner_projects()
        pushgateway_url = get_pushgateway_url()

        (
            mapping_by_domain, unique_domains, total_a_records, matched_server_ips, unmatched_ips, 
            ip_to_server, unmapped_servers, diff, recommendations, port_audit_results, 
            security_alerts, cleanup_flags
        ) = process_servers_and_domains(cloudflare_token, hetzner_projects, metrics)

        # Generate premium interactive dashboard and print-optimized report
        html_dashboard = generate_html_dashboard(mapping_by_domain, unique_domains, total_a_records, matched_server_ips, ip_to_server)
        html_print = generate_print_html(mapping_by_domain, unique_domains, total_a_records, matched_server_ips, ip_to_server)

        # Save HTML, JSON, and compile PDF report
        pdf_file = save_reports(
            html_dashboard, 
            html_print, 
            datetime.now().strftime("%Y%m%d_%H%M%S"),
            mapping_by_domain,
            unique_domains,
            total_a_records,
            matched_server_ips,
            ip_to_server,
            unmapped_servers,
            diff,
            recommendations,
            port_audit_results,
            security_alerts,
            cleanup_flags
        )

        # Dispatch Slack and Google Chat notifications
        dispatch_notifications(pdf_file, unique_domains, total_a_records, matched_server_ips, ip_to_server)

        metrics['domains'].set(len(unique_domains))
        metrics['a_records'].set(total_a_records)
        metrics['matched_servers'].set(len(matched_server_ips))
        metrics['unmatched_ips'].set(len(unmatched_ips))
        print(f"Processing complete. {len(unique_domains)} domains, {total_a_records} A records, {len(matched_server_ips)} matched servers.")

    except Exception as e:
        error_occurred = True
        print(f"Error during processing: {e}")
        metrics['error_counter'].inc()
        raise

    finally:
        duration = time.time() - start_time
        metrics['run_duration'].set(duration)
        metrics['run_counter'].inc()

        try:
            if pushgateway_url:
                push_to_gateway(pushgateway_url, job='cloudmesh', registry=registry)
                print("Metrics pushed to Prometheus successfully.")
        except Exception as e:
            print(f"Error pushing metrics to Prometheus: {e}")

    profiler.disable()
    profiler_stats = pstats.Stats(profiler)
    profiler_stats.sort_stats('cumulative')
    print("\n--- Performance Profile ---")
    profiler_stats.print_stats(10)

def main():
    from src.config import get_monitoring_interval
    interval = get_monitoring_interval()

    if interval > 0:
        print(f"Scheduled Monitoring Mode Active: running audits every {interval} seconds.")
        while True:
            try:
                run_audit()
            except Exception as e:
                print(f"Scheduled audit execution failed: {e}")
            print(f"Sleeping for {interval} seconds before next run...")
            time.sleep(interval)
    else:
        run_audit()

if __name__ == "__main__":
    main()
