import os
import requests
from src.core.matcher import get_domain_expiry, get_days_to_expiry

def send_message_to_slack(token, channel_id, text):
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    data = {
        "channel": channel_id,
        "text": text
    }
    response = requests.post('https://slack.com/api/chat.postMessage', headers=headers, json=data)
    response_json = response.json()

    if not response_json['ok']:
        print(f"Error in chat.postMessage: {response_json['error']}")
        return response_json

    return response_json

def upload_to_slack(file_path, token, channel_id, initial_comment):
    filename = os.path.basename(file_path)
    file_size = os.path.getsize(file_path)

    headers = {
        'Authorization': f'Bearer {token}',
    }
    data = {
        "filename": filename,
        "length": file_size
    }
    response = requests.post('https://slack.com/api/files.getUploadURLExternal', headers=headers, data=data)
    response_json = response.json()

    if not response_json['ok']:
        print(f"Error in getUploadURLExternal: {response_json['error']}")
        return response_json

    upload_url = response_json['upload_url']
    file_id = response_json['file_id']

    with open(file_path, 'rb') as file_content:
        files = {'file': (filename, file_content, 'application/pdf')}
        upload_response = requests.post(upload_url, files=files)
        if upload_response.status_code != 200:
            print(f"Error uploading file: {upload_response.status_code}")
            print(upload_response.text)
            return {"ok": False, "error": "upload_failed"}

    headers['Content-Type'] = 'application/json'
    data = {
        "files": [{"id": file_id, "title": filename}],
        "channel_id": channel_id,
        "initial_comment": initial_comment
    }
    complete_response = requests.post(
        'https://slack.com/api/files.completeUploadExternal',
        headers=headers,
        json=data
    )

    try:
        complete_response_json = complete_response.json()
    except ValueError:
        print(f"Error in completeUploadExternal: Unable to decode JSON response")
        print(complete_response.text)
        return {"ok": False, "error": "json_decode_failed"}

    if not complete_response_json['ok']:
        print(f"Error in completeUploadExternal: {complete_response_json['error']}")

    return complete_response_json

def send_expiring_domains_warning(unique_domains, slack_token, slack_channel):
    if not slack_token or not slack_channel:
        return

    expiring = []
    for domain in unique_domains:
        expiry_str = get_domain_expiry(domain)
        days = get_days_to_expiry(expiry_str)
        if days is not None and days <= 30:
            expiring.append((domain, expiry_str, days))

    if not expiring:
        return  # nothing to report

    lines = ["⚠️ *DOMAINS EXPIRING SOON (≤ 30 days)* ⚠️"]
    for domain, exp_date, days_left in sorted(expiring, key=lambda x: x[2]):
        if days_left < 0:
            status = f"**EXPIRED** ({abs(days_left)} days ago)"
        elif days_left == 0:
            status = "**EXPIRES TODAY**"
        else:
            status = f"in *{days_left} days*"
        lines.append(f"• {domain} — expires {exp_date}  ({status})")

    message = "\n".join(lines)

    headers = {
        'Authorization': f'Bearer {slack_token}',
        'Content-Type': 'application/json'
    }
    payload = {
        "channel": slack_channel,
        "text": message
    }
    try:
        resp = requests.post("https://slack.com/api/chat.postMessage", headers=headers, json=payload)
        if not resp.json().get("ok"):
            print("Failed to send expiration warning to Slack:", resp.json())
    except Exception as e:
        print("Error sending expiration warning:", e)
