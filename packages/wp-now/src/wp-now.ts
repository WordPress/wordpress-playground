import { PHP, SupportedPHPVersion } from '@php-wasm/node'
import path from 'path'
import { WORDPRESS_VERSIONS_PATH } from './constants'

interface WPNowOptions {
  phpVersion?: SupportedPHPVersion
  documentRoot?: string
  absoluteUrl?: string
}

const DEFAULT_OPTIONS: WPNowOptions = {
  phpVersion: '8.0',
  documentRoot: '/wp-now',
  absoluteUrl: 'http://localhost:8881',
}

export default class WPNow {
  php: PHP
  options: WPNowOptions = DEFAULT_OPTIONS

  static async create(options: WPNowOptions = {}): Promise<WPNow> {
    const instance = new WPNow();
    await instance.setup(options);
    return instance;
  }

  async setup(options: WPNowOptions = {}) {
    this.options = {
      ...this.options,
      ...options,
    }
    const { phpVersion, documentRoot, absoluteUrl } = this.options
    this.php = await PHP.load(phpVersion, {
      requestHandler: {
        documentRoot,
        absoluteUrl,
      }
    })
    this.php.mkdirTree(documentRoot)
    this.php.chdir(documentRoot)
    this.php.writeFile(`${documentRoot}/index.php`, `<?php echo 'Hello wp-now!';`)
  }

  mountWordpress(fileName = 'latest') {
    const root = path.join(WORDPRESS_VERSIONS_PATH, fileName, 'wordpress')
    this.php.mount({
      root,
    }, this.options.documentRoot)
  }

  cleanHeaders(headers: Record<string, string | string[]>) {
    // fix the location header
    // [ 'http://localhost:8881var/www/html/wp-admin/setup-config.php' ]
    let safeHeaders = headers
    if (Array.isArray(headers.location)) {
      safeHeaders = {
        ...headers,
        location: headers.location.map(url => url.replace(`${this.options.absoluteUrl}${this.options.documentRoot.slice(1)}`, this.options.absoluteUrl)),
      }
    }
    return safeHeaders
  }

  async runCode(code) {
    const result = await this.php.run({
      code,
    })
    console.log(result.text)
    return result
  }

  async start() {
    console.log('start')
    return null
  }
}
