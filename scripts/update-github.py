"""Refresh assets/data/gh.json, the GitHub contribution calendar on The Route, from GitHub's GraphQL API.

    GH_TOKEN=... python3 scripts/update-github.py        (locally: GH_TOKEN=$(gh auth token))

On any failure the saved calendar is kept, so a build never breaks because GitHub is unreachable.
"""
import datetime
import json
import os
import pathlib
import sys
import urllib.request

LOGIN = 'anarzone'
OUT = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'data' / 'gh.json'
QUERY = """query($login: String!) { user(login: $login) { contributionsCollection { contributionCalendar {
  totalContributions weeks { contributionDays { date contributionCount } } } } } }"""


def main():
    token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if not token:
        print('no GH_TOKEN; keeping the saved calendar')
        return
    body = json.dumps({'query': QUERY, 'variables': {'login': LOGIN}}).encode()
    req = urllib.request.Request('https://api.github.com/graphql', data=body,
                                 headers={'Authorization': f'bearer {token}', 'Content-Type': 'application/json', 'User-Agent': 'anar.to-build'})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            cal = json.load(r)['data']['user']['contributionsCollection']['contributionCalendar']
    except Exception as e:  # network, auth or shape problems all mean: keep what we have
        print(f'GitHub calendar not refreshed ({e}); keeping the saved one')
        return
    days = [d for w in cal['weeks'] for d in w['contributionDays']]
    if not days:
        print('GitHub returned no days; keeping the saved calendar')
        return
    today = datetime.date.today()
    OUT.write_text(json.dumps({'from': days[0]['date'], 'date': f'{today.day} {today:%b %Y}', 'total': cal['totalContributions'],
                               'counts': [d['contributionCount'] for d in days]}, separators=(',', ':')) + '\n')
    print(f"GitHub calendar: {cal['totalContributions']} contributions, {days[0]['date']} to {days[-1]['date']}")


if __name__ == '__main__':
    sys.exit(main())
