import { PHP, SupportedPHPVersion } from '@php-wasm/node'

interface WPNowOptions {
  phpVersion?: SupportedPHPVersion
  documentRoot?: string
  absoluteUrl?: string
}

const WP_NOW_FOLDER = '~/.wp-now'

export default class WPNow {
  php: PHP

  static async create(options: WPNowOptions = {}): Promise<WPNow> {
    const instance = new WPNow();
    await instance.setup(options);
    return instance;
  }

  async setup(options: WPNowOptions = {}) {
    const {
      phpVersion = '8.0',
      documentRoot = '/var/www/html',
      absoluteUrl = 'http://localhost:8080',
    } = options
    this.php = await PHP.load(phpVersion, {
      requestHandler: {
        documentRoot,
        absoluteUrl,
      }
    })
    this.php.mkdirTree(documentRoot)
    this.php.writeFile(`${documentRoot}/index.php`, `<?php echo 'Hello wp-now!';`)
  }

  async runFile(path) {
    const result = await this.php.request({
      url: path,
    })
    console.log(result.text)
    return result
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
