from bs4 import BeautifulSoup

def on_page_content(html, page, config, files):
    html = html.replace("\\\n", '<br/>\n')
    soup = BeautifulSoup(html, 'html.parser')
    for a in soup.find_all('a'):
        if a['href'].startswith('http'):
            a['target'] = '_blank'

    return str(soup)
