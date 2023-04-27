import fs from 'fs-extra';
import { NodePHP } from '@php-wasm/node'
import { SupportedPHPVersion } from '@php-wasm/universal'
import path from 'path'
import { SQLITE_FILENAME, SQLITE_PATH, WORDPRESS_ZIPS_PATH, WP_NOW_HIDDEN_FOLDER } from './constants'
import { downloadSqlite, downloadWordPress } from './download'
import { portFinder } from './port-finder'

export interface WPNowOptions {
  phpVersion?: SupportedPHPVersion
  documentRoot?: string
  absoluteUrl?: string
  mode?: 'plugin' | 'theme' | 'core' | 'index'
  projectPath?: string
}

const DEFAULT_OPTIONS: WPNowOptions = {
  phpVersion: '8.0',
  documentRoot: '/var/www/html',
  mode: 'index',
}
async function getAbsoluteURL() {
  const port = await portFinder.getOpenPort()
  return `http://127.0.0.1:${port}`
}

function seemsLikeAPHPFile(path) {
	return path.endsWith('.php') || path.includes('.php/');
}

export default class WPNow {
  php: NodePHP
  options: WPNowOptions = DEFAULT_OPTIONS


  static async create(options: WPNowOptions = {}): Promise<WPNow> {
    const instance = new WPNow();
    const absoluteUrl = await getAbsoluteURL();
    const projectPath = process.cwd()
    await instance.#setup({
      absoluteUrl,
      projectPath,
      ...options,
    });
    return instance;
  }

  patchFile = (path, callback) => {
    this.php.writeFile(path, callback(this.php.readFileAsText(path)));
  }

  async #setup(options: WPNowOptions = {}) {
    this.options = {
      ...this.options,
      ...options,
    }
    const { phpVersion, documentRoot, absoluteUrl } = this.options
    this.php = await NodePHP.load(phpVersion, {
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
    const root = path.join(WORDPRESS_ZIPS_PATH, fileName, 'wordpress')
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
  this.php.mkdirTree(`${documentRoot}/wp-content/mu-plugins`);
  this.php.writeFile(
      `${documentRoot}/wp-content/mu-plugins/0-allow-wp-org.php`,
      `<?php
      // Needed because gethostbyname( 'wordpress.org' ) returns
      // a private network IP address for some reason.
      add_filter( 'allowed_redirect_hosts', function( $deprecated = '' ) {
          return array(
              'wordpress.org',
              'api.wordpress.org',
              'downloads.wordpress.org',
          );
      } );`
  );
  }

  async runCode(code) {
    const result = await this.php.run({
      code,
    })
    console.log(result.text)
    return result
  }

  mountSqlite() {
    const { documentRoot } = this.options
    const sqlitePluginPath = `${documentRoot}/wp-content/plugins/${SQLITE_FILENAME}`
    this.php.mkdirTree(sqlitePluginPath)
    this.php.mount(SQLITE_PATH, sqlitePluginPath)
    this.php.writeFile(
      `${documentRoot}/wp-content/db.php`,
      this.php.readFileAsText(`${sqlitePluginPath}/db.copy`)
        .replace(/\{SQLITE_IMPLEMENTATION_FOLDER_PATH\}/g, `${documentRoot}/wp-content/plugins/${SQLITE_FILENAME}`)
        .replace(/\{SQLITE_PLUGIN\}/g, SQLITE_FILENAME)
    )
  }

  mount() {
    if (this.options.mode === 'index') {
      this.php.mount(this.options.projectPath, this.options.documentRoot)
      return
    }
    // Mode core, plugin or theme
    this.mountWordpress()
    // Copy wp-content to local hidden folder
    const wpContentPath = path.join(this.options.projectPath, WP_NOW_HIDDEN_FOLDER, 'wp-content')
    fs.ensureDirSync(wpContentPath);
    fs.copySync(path.join(WORDPRESS_ZIPS_PATH, 'latest', 'wordpress', 'wp-content'), wpContentPath)
    this.php.mount(wpContentPath, `${this.options.documentRoot}/wp-content`)

    if (this.options.mode === 'plugin' || this.options.mode === 'theme') {
      const folderName = path.basename(this.options.projectPath)
      const partialPath = this.options.mode === 'plugin' ? 'plugins' : 'themes'
      fs.ensureDirSync(path.join(wpContentPath, partialPath, folderName));
      this.php.mount(this.options.projectPath, `${this.options.documentRoot}/wp-content/${partialPath}/${folderName}`)
    }
    this.mountSqlite()
  }

  async registerUser() {
    return this.php.request({
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
  }

  async autoLogin() {
    await this.php.request({
      url: '/wp-login.php',
    });

    await this.php.request({
      url: '/wp-login.php',
      method: 'POST',
      formData: {
        log: 'admin',
        pwd: 'password',
        rememberme: 'forever',
      },
    });
  }

  async start() {
    await downloadWordPress()
    await downloadSqlite()
    this.mount()
    await this.registerUser()
    await this.autoLogin()
  }

}
