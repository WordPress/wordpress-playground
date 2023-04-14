import { PHP, SupportedPHPVersion } from '@php-wasm/node'
import path from 'path'
import { SQLITE_URL, WORDPRESS_VERSIONS_PATH } from './constants'

interface WPNowOptions {
  phpVersion?: SupportedPHPVersion
  documentRoot?: string
  absoluteUrl?: string
}

const DEFAULT_OPTIONS: WPNowOptions = {
  phpVersion: '8.0',
  documentRoot: '/var/www/html',
  absoluteUrl: 'http://127.0.0.1:8881',
}

function seemsLikeAPHPFile(path) {
	return path.endsWith('.php') || path.includes('.php/');
}

async function fetchAsUint8Array(url) {
	const fetchModule = await import('node-fetch');
	const fetch = fetchModule.default;
	const response = await fetch(url);
	return new Uint8Array(await response.arrayBuffer());
}

export default class WPNow {
  php: PHP
  options: WPNowOptions = DEFAULT_OPTIONS

  static async create(options: WPNowOptions = {}): Promise<WPNow> {
    const instance = new WPNow();
    await instance.setup(options);
    return instance;
  }

  patchFile = (path, callback) => {
    this.php.writeFile(path, callback(this.php.readFileAsText(path)));
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
        isStaticFilePath: (path) => {
          try {
              const fullPath = this.options.documentRoot + path;
              return this.php.fileExists(fullPath)
                  && !this.php.isDir(fullPath)
                  && !seemsLikeAPHPFile(fullPath);
          } catch (e) {
              console.error(e);
              return false;
          }
        },

      }
    })
    this.php.mkdirTree(documentRoot)
    this.php.chdir(documentRoot)
    this.php.writeFile(`${documentRoot}/index.php`, `<?php echo 'Hello wp-now!';`)
  }

  mountWordpress(fileName = 'latest') {
    const { documentRoot } = this.options
    const root = path.join(WORDPRESS_VERSIONS_PATH, fileName, 'wordpress')
    this.php.mount({
      root,
    }, documentRoot)
    this.php.writeFile(
      `${documentRoot}/wp-config.php`,
      this.php.readFileAsText(`${documentRoot}/wp-config-sample.php`)
  );
  this.patchFile(
      `${documentRoot}/wp-config.php`,
      (contents) =>
          `<?php
          define('WP_HOME', "${this.options.absoluteUrl}");
          define('WP_SITEURL', "${this.options.absoluteUrl}");
          ?>${contents}`
  );
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

  async downloadSqlite() {
    const { documentRoot } = this.options
    const sqliteZip = await fetchAsUint8Array(SQLITE_URL)
    this.php.writeFile('/sqlite-database-integration.zip', sqliteZip);
    const results = await this.php.run({
      code: `<?php
  function extractZip($zipPath, $destination) {
      $zip = new ZipArchive;
      $res = $zip->open($zipPath);
      if ($res === TRUE) {
          $zip->extractTo($destination);
          $zip->close();
      }
  }
  extractZip('/sqlite-database-integration.zip', '${documentRoot}/wp-content/plugins/');
  rename('${documentRoot}/wp-content/plugins/sqlite-database-integration-main', '${documentRoot}/wp-content/plugins/sqlite-database-integration');
  `
    });
    console.log('--->', results)
    this.php.writeFile(
      `${documentRoot}/wp-content/db.php`,
      this.php.readFileAsText(`${documentRoot}/wp-content/plugins/sqlite-database-integration/db.copy`)
        .replace(/\{SQLITE_IMPLEMENTATION_FOLDER_PATH\}/g, `${documentRoot}/wp-content/plugins/sqlite-database-integration`)
        .replace(/\{SQLITE_PLUGIN\}/g, 'sqlite-database-integration')
    )
  }

  async activateSqlite() {
    await this.php.request({
      url: '/wp-admin/install.php?step=2',
      method: 'POST',
      formData: {
        language: 'en',
        prefix: 'wp_',
        weblog_title: 'My WordPress Website',
        user_name: 'admin',
        admin_password: 'password',
        admin_password2: 'password',
        Submit: 'Install WordPress',
        pw_weak: '1',
        admin_email: 'admin@localhost.com'
      }
    });

    // const { login } = await import('@wp-playground/client');
    // await login(this.php as any, 'admin', 'password');
  }
}
