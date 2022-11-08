def on_page_content(html, page, config, files):
    return html.replace("\\\n", '<br/>\n')
