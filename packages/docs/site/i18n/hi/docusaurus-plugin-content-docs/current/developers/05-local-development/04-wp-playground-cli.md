---
title: Playground CLI
slug: /developers/local-development/wp-playground-cli
---

# Playground CLI

<!-- [@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) is a command-line tool that simplifies the WordPress development and testing flow.
Playground CLI supports auto-mounting a directory with a plugin, theme, or WordPress installation. But if you need flexibility, the CLI supports mount options to personalize your local environment. -->

[@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) एक कमांड-लाइन टूल है, जो WordPress डेवलपमेंट और परीक्षण की प्रक्रिया को आसान बनाता है। Playground CLI प्लगइन, थीम या WordPress इंस्टॉलेशन वाली डायरेक्टरी को अपने-आप माउंट कर सकता है। अगर आपको ज़्यादा लचीलापन चाहिए, तो CLI में माउंट के विकल्प भी हैं, जिनसे आप अपना लोकल एनवायरनमेंट अपने हिसाब से सेट कर सकते हैं।

<!-- **Key features:** -->

**मुख्य फ़ीचर:**

<!-- - **Quick Setup**: Set up a local WordPress environment in seconds.
- **Flexibility**: Allows for configuration to adapt to different scenarios.
- **Simple Environment**: No extra configuration, just a compatible Node version, and you are ready to use it. -->

- **तेज़ सेटअप**: कुछ ही सेकंड में लोकल WordPress एनवायरनमेंट सेट अप करें।
- **लचीलापन**: अलग-अलग स्थितियों के हिसाब से कॉन्फ़िगरेशन बदलने की सुविधा देता है।
- **सरल एनवायरनमेंट**: कोई अतिरिक्त कॉन्फ़िगरेशन नहीं, बस Node का एक संगत संस्करण चाहिए और आप इसका उपयोग शुरू कर सकते हैं।

<!-- The Playground CLI includes two main commands for running WordPress locally: -->

लोकल मशीन पर WordPress चलाने के लिए Playground CLI में दो मुख्य कमांड हैं:

<!-- - **`start`** (Simplified): Auto-detects your project type, persists sites between sessions, and opens a browser automatically.
- **`server`** (Advanced): Provides full manual control over configuration. Best for custom setups, CI/CD pipelines, or when you need fine-grained control. -->

- **`start`** (सरल): आपके प्रोजेक्ट का प्रकार अपने-आप पहचानता है, साइटों को एक सेशन से दूसरे सेशन तक सहेजकर रखता है और ब्राउज़र अपने-आप खोलता है।
- **`server`** (उन्नत): कॉन्फ़िगरेशन पर पूरा मैन्युअल नियंत्रण देता है। कस्टम सेटअप, CI/CD पाइपलाइन, या जब आपको बारीक नियंत्रण चाहिए, तब के लिए यह सबसे अच्छा है।

<!-- ## Requirements -->

## ज़रूरतें {#requirements}

<!-- The Playground CLI requires Node.js 24.18 or higher. You can download it from the [Node.js website](https://nodejs.org/en/download). -->

Playground CLI के लिए Node.js 24.18 या उससे नया संस्करण ज़रूरी है। आप इसे [Node.js की वेबसाइट](https://nodejs.org/en/download) से डाउनलोड कर सकते हैं।

<!-- ## Quickstart -->

## जल्दी शुरुआत {#quickstart}

<!-- To run the Playground CLI, open a command line and use one of the following commands: -->

Playground CLI चलाने के लिए कमांड लाइन खोलें और नीचे दी गई कमांड में से किसी एक का उपयोग करें:

<!-- ### Using `start` (Simplified) -->

### सरल तरीका: `start` का उपयोग {#using-start-simplified}

<!-- The `start` command is the easiest way to get started. It automatically detects your project type, persists your site, and opens the browser: -->

शुरुआत करने का सबसे आसान तरीका `start` कमांड है। यह आपके प्रोजेक्ट का प्रकार अपने-आप पहचानती है, आपकी साइट को सहेजकर रखती है और ब्राउज़र खोलती है:

```bash
npx @wp-playground/cli@latest start
```

<!-- When run inside a plugin or theme directory, `start` automatically mounts your project: -->

किसी प्लगइन या थीम की डायरेक्टरी के अंदर चलाने पर `start` आपके प्रोजेक्ट को अपने-आप माउंट करता है:

```bash
cd my-plugin
npx @wp-playground/cli@latest start
```

<!-- **Key differences from `server`:** -->

**इसमें और `server` में मुख्य अंतर:**

<!-- - Auto-login is enabled by default
- Opens browser automatically
- Auto-mounts the project by default -->

- ऑटो-लॉगिन डिफ़ॉल्ट रूप से चालू होता है
- ब्राउज़र अपने-आप खुलता है
- प्रोजेक्ट डिफ़ॉल्ट रूप से अपने-आप माउंट होता है

<!-- ### Using `server` (Advanced) -->

### उन्नत तरीका: `server` का उपयोग {#using-server-advanced}

<!-- The `server` command provides full control over configuration: -->

कॉन्फ़िगरेशन पर पूरा नियंत्रण `server` कमांड से मिलता है:

```bash
npx @wp-playground/cli@latest server
```

<!-- ![Playground CLI in Action](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/developers/npx-wp-playground-server.gif) -->

![Playground CLI काम करते हुए](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/developers/npx-wp-playground-server.gif)

<!-- ### Choosing a WordPress and PHP Version -->

### WordPress और PHP का संस्करण चुनना {#choosing-a-wordpress-and-php-version}

<!-- By default, the CLI loads the latest stable version of WordPress and PHP 8.3. To specify your preferred versions, use the `--wp=<version>` and `--php=<version>` flags: -->

डिफ़ॉल्ट रूप से CLI WordPress का नवीनतम स्थिर संस्करण और PHP 8.3 लोड करता है। अपनी पसंद के संस्करण तय करने के लिए `--wp=<version>` और `--php=<version>` फ़्लैग का उपयोग करें:

```bash
npx @wp-playground/cli@latest server --wp=6.8 --php=8.4
```

<!-- ### Loading Blueprints -->

### ब्लूप्रिंट लोड करना {#loading-blueprints}

<!-- One way to take your Playground CLI development experience to the next level is to integrate with [Blueprints](/blueprints/getting-started/). Blueprints let developers configure the initial state of their WordPress Playground instances. -->

Playground CLI के साथ अपने डेवलपमेंट अनुभव को अगले स्तर पर ले जाने का एक तरीका है उसे [ब्लूप्रिंट](/blueprints/getting-started/) के साथ जोड़ना। ब्लूप्रिंट की मदद से डेवलपर अपने WordPress Playground इंस्टेंस की शुरुआती स्थिति कॉन्फ़िगर कर सकते हैं।

<!-- Using the `--blueprint=<blueprint-address>` flag, developers can run a Playground with a custom initial state. We’ll use the example below to do this. -->

डेवलपर `--blueprint=<blueprint-address>` फ़्लैग का उपयोग करके कस्टम शुरुआती स्थिति वाला Playground चला सकते हैं। इसके लिए हम नीचे दिए गए उदाहरण का उपयोग करेंगे।

**(my-blueprint.json)**

```json
{
	"landingPage": "/wp-admin/",
	"login": true,
	"plugins": ["hello-dolly", "https://raw.githubusercontent.com/adamziel/blueprints/trunk/docs/assets/hello-from-the-dashboard.zip"]
}
```

<!-- CLI command that loads the Blueprint: -->

ब्लूप्रिंट लोड करने वाली CLI कमांड:

```bash
npx @wp-playground/cli@latest server --blueprint=my-blueprint.json
```

<!-- #### Missing constants after a login step in CLI 3.1.64 and 3.1.65 -->

#### CLI 3.1.64 और 3.1.65 में लॉगिन स्टेप के बाद कॉन्स्टेंट गायब होना {#missing-constants-after-a-login-step-in-cli-3164-and-3165}

<!-- In CLI 3.1.64 and 3.1.65, running `login` followed by `defineWpConfigConsts` with multiple workers can lose constants, including `SQLITE_JOURNAL_MODE`. CLI 3.1.66 fixes this, so upgrade if you can. On an older version, run the `server` command with `--workers=1`. If you need multiple workers, set `"method": "rewrite-wp-config"` on the `defineWpConfigConsts` step to write those constants to `wp-config.php`. See the [SQLite corruption report](https://github.com/WordPress/wordpress-playground/issues/4615) for details. -->

CLI 3.1.64 और 3.1.65 में, कई वर्कर के साथ `login` के बाद `defineWpConfigConsts` चलाने पर कॉन्स्टेंट खो सकते हैं, जिनमें `SQLITE_JOURNAL_MODE` भी शामिल है। CLI 3.1.66 में यह ठीक हो गया है, इसलिए हो सके तो अपग्रेड करें। पुराने संस्करण पर `server` कमांड को `--workers=1` के साथ चलाएँ। अगर आपको कई वर्कर चाहिए, तो उन कॉन्स्टेंट को `wp-config.php` में लिखने के लिए `defineWpConfigConsts` स्टेप पर `"method": "rewrite-wp-config"` सेट करें। ज़्यादा जानकारी के लिए [SQLite करप्शन की रिपोर्ट](https://github.com/WordPress/wordpress-playground/issues/4615) देखें।

<!-- ### Mounting folders manually -->

### फ़ोल्डर मैन्युअल रूप से माउंट करना {#mounting-folders-manually}

<!-- Some projects need a custom setup, for example when auto-mount does not detect your project type. In this case, use the `--mount` flag to tell Playground CLI where to mount your project. This example mounts the current directory as a plugin: -->

कुछ प्रोजेक्ट्स को कस्टम सेटअप की ज़रूरत होती है, उदाहरण के लिए जब ऑटो-माउंट आपके प्रोजेक्ट का प्रकार नहीं पहचान पाता। ऐसे में Playground CLI को यह बताने के लिए कि आपका प्रोजेक्ट कहाँ माउंट करना है, `--mount` फ़्लैग का उपयोग करें। यह उदाहरण मौजूदा डायरेक्टरी को प्लगइन के रूप में माउंट करता है:

```bash
npx @wp-playground/cli@latest server --mount=.:/wordpress/wp-content/plugins/MY-PLUGIN-DIRECTORY
```

<!-- ### Mounting before WordPress installation -->

### WordPress इंस्टॉलेशन से पहले माउंट करना {#mounting-before-wordpress-installation}

<!-- Consider mounting your WordPress project files before the WordPress installation begins. This approach is beneficial if you want to override the Playground boot process, as it can help connect Playground with `WP-CLI`. The `--mount-before-install` flag supports this process. -->

WordPress इंस्टॉलेशन शुरू होने से पहले अपनी WordPress प्रोजेक्ट फ़ाइलें माउंट करने पर विचार करें। अगर आप Playground की बूट प्रक्रिया को ओवरराइड करना चाहते हैं, तो यह तरीका फ़ायदेमंद है, क्योंकि इससे Playground को `WP-CLI` से जोड़ने में मदद मिल सकती है। `--mount-before-install` फ़्लैग इस प्रक्रिया को सपोर्ट करता है।

```bash
npx @wp-playground/cli@latest server --mount-before-install=.:/wordpress/
```

<div class="callout callout-info">

<!-- On Windows, the path format `/host/path:/vfs/path` can cause issues. To resolve this, use the flags `--mount-dir` and `--mount-dir-before-install`. These flags let you specify host and virtual file system paths in an alternative format: `"/host/path"` `"/vfs/path"`. -->

Windows पर `/host/path:/vfs/path` पाथ फ़ॉर्मैट से समस्याएँ हो सकती हैं। इन्हें दूर करने के लिए `--mount-dir` और `--mount-dir-before-install` फ़्लैग का उपयोग करें। इन फ़्लैग से आप होस्ट और वर्चुअल फ़ाइल सिस्टम के पाथ एक दूसरे फ़ॉर्मैट में दे सकते हैं: `"/host/path"` `"/vfs/path"`।

</div>

<!-- ### Understanding Data Persistence and SQLite Location in `server` mode -->

### डेटा कैसे सहेजा जाता है और SQLite कहाँ होता है (`server` मोड) {#understanding-data-persistence-and-sqlite-location-in-server-mode}

<!-- By default, Playground CLI stores WordPress files and the SQLite database in **temporary directories on your operating system**: -->

डिफ़ॉल्ट रूप से Playground CLI WordPress फ़ाइलें और SQLite डेटाबेस **आपके ऑपरेटिंग सिस्टम की अस्थायी डायरेक्टरी में** रखता है:

```
<OS-TEMP-DIR>/node-playground-cli-site-<id>/
├── wordpress/         # WordPress installation
├── internal/          # Playground runtime config
├── tools/             # Playground tools
├── tmp/               # Temporary PHP files
└── home/              # Home directory for the PHP runtime
```

<!-- **Finding Your Temp Directory:** -->

**अपनी अस्थायी डायरेक्टरी ढूँढना:**

<!-- The actual location depends on your OS (these are examples or common possibilities): -->

असल जगह आपके OS पर निर्भर करती है (ये कुछ उदाहरण या आम संभावनाएँ हैं):

<!-- - **macOS/Linux**: May be under `/tmp/` or `/private/var/folders/` (varies by system)
- **Windows**: `C:\Users\<username>\AppData\Local\Temp\` -->

- **macOS/Linux**: `/tmp/` या `/private/var/folders/` के अंदर हो सकती है (हर सिस्टम पर अलग)
- **Windows**: `C:\Users\<username>\AppData\Local\Temp\`

<!-- To see the exact temp directory path being used, run the CLI with the `--verbosity=debug` flag: -->

उपयोग हो रही अस्थायी डायरेक्टरी का सटीक पाथ देखने के लिए CLI को `--verbosity=debug` फ़्लैग के साथ चलाएँ:

```bash
npx @wp-playground/cli@latest server --verbosity=debug
```

<!-- This will output something like: -->

इसका आउटपुट कुछ ऐसा होगा:

```
Native temp dir for VFS root:
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC
Mount before WP install: /home ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/home
Mount before WP install: /tmp ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/tmp
Mount before WP install: /tools ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/tools
Mount before WP install: /wordpress ->
/private/var/folders/c8/mwz12ycx4s509056kby3hk180000gn/T/node-playground-cli-site-62926--62926-yQNOdvJVIgYC/wordpress
```

<!-- **Where is the SQLite Database Stored?** -->

**SQLite डेटाबेस कहाँ सहेजा जाता है?**

<!-- The database location depends on what you mount: -->

डेटाबेस की जगह इस पर निर्भर करती है कि आप क्या माउंट करते हैं:

<!-- - **Auto-mounting a full WordPress directory**:
    - Database directory: `<your-local-project>/wp-content/database/`
    - ✅ **Persisted locally** in your project folder -->

- **पूरी WordPress डायरेक्टरी को ऑटो-माउंट करने पर**:
    - डेटाबेस डायरेक्टरी: `<your-local-project>/wp-content/database/`
    - ✅ आपके प्रोजेक्ट फ़ोल्डर में **लोकल रूप से सहेजा जाता है**

<!-- - **Auto-mounting a wp-content directory**:
    - Auto-mount mounts each item inside `wp-content` separately, so the database persists in `<your-local-project>/wp-content/database/` only if that folder already exists
    - ⚠️ Otherwise, the database is created in the temporary directory and is **lost when the server stops** -->

- **किसी wp-content डायरेक्टरी को ऑटो-माउंट करने पर**:
    - ऑटो-माउंट `wp-content` के अंदर की हर चीज़ को अलग-अलग माउंट करता है, इसलिए डेटाबेस `<your-local-project>/wp-content/database/` में तभी सहेजा जाता है, जब वह फ़ोल्डर पहले से मौजूद हो
    - ⚠️ नहीं तो डेटाबेस अस्थायी डायरेक्टरी में बनता है और **सर्वर रुकने पर मिट जाता है**

<!-- - **Auto-mounting plugin/theme only**:
    - Database directory: `<OS-TEMP-DIR>/node-playground-cli-site-<id>/wordpress/wp-content/database/`
    - ⚠️ **Lost when server stops** (temp directories are cleaned up) -->

- **सिर्फ़ प्लगइन/थीम को ऑटो-माउंट करने पर**:
    - डेटाबेस डायरेक्टरी: `<OS-TEMP-DIR>/node-playground-cli-site-<id>/wordpress/wp-content/database/`
    - ⚠️ **सर्वर रुकने पर मिट जाता है** (अस्थायी डायरेक्टरी साफ़ कर दी जाती हैं)

<!-- - **Custom mounts**: Database location follows your mount configuration -->

- **कस्टम माउंट**: डेटाबेस की जगह आपके माउंट कॉन्फ़िगरेशन के हिसाब से तय होती है

<!-- **Automatic Cleanup:**
Playground CLI automatically removes temp directories that are: -->

**अपने-आप सफ़ाई:** Playground CLI उन अस्थायी डायरेक्टरी को अपने-आप हटा देता है, जो:

<!-- - Older than 2 days
- No longer associated with a running process -->

- 2 दिन से ज़्यादा पुरानी हैं
- अब किसी चल रही प्रोसेस से जुड़ी नहीं हैं

<!-- **Recommendation:** To persist both your code and database when developing plugins or themes, mount the entire `wp-content` directory before installation with `--mount-before-install`, instead of mounting only the plugin or theme directory. -->

**सुझाव:** प्लगइन या थीम डेवलप करते समय अपना कोड और डेटाबेस, दोनों सहेजकर रखने के लिए सिर्फ़ प्लगइन या थीम की डायरेक्टरी माउंट करने के बजाय `--mount-before-install` का उपयोग करके इंस्टॉलेशन से पहले पूरी `wp-content` डायरेक्टरी माउंट करें।

<!-- **Example: Mounting wp-content for persistence** -->

**उदाहरण: डेटा सहेजकर रखने के लिए wp-content माउंट करना**

```bash
# Mount wp-content before installation so the database is written there
cd my-wordpress-project
npx @wp-playground/cli@latest server --mount-before-install=./wp-content:/wordpress/wp-content
```

<!-- ### Data Persistence in `start` mode -->

### डेटा कैसे सहेजा जाता है (`start` मोड) {#data-persistence-in-start-mode}

<!-- When `start` manages the WordPress root directory, Playground CLI
**automatically persists** your WordPress site in a dedicated directory: -->

जब `start` WordPress की रूट डायरेक्टरी खुद संभालता है, तो Playground CLI आपकी WordPress साइट को एक अलग डायरेक्टरी में **अपने-आप सहेजकर रखता है**:

```
~/.wordpress-playground/sites/<path-hash>/
├── wp-admin/
├── wp-content/
├── wp-includes/
└── wp-config.php
```

<!-- This directory is the WordPress root itself. -->

यह डायरेक्टरी खुद WordPress की रूट डायरेक्टरी है।

<!-- The `<path-hash>` is derived from the command's current working directory.
This ensures isolation between different projects when you run `start` from each
project directory. -->

कमांड जिस मौजूदा वर्किंग डायरेक्टरी से चलाई जाती है, `<path-hash>` उसी से बनता है। इससे जब आप हर प्रोजेक्ट की डायरेक्टरी से `start` चलाते हैं, तो अलग-अलग प्रोजेक्ट्स एक-दूसरे से अलग रहते हैं।

<!-- #### Persistence behavior -->

#### साइट सहेजने का व्यवहार {#persistence-behavior}

<!-- - **Default (no WordPress root mount)**: WordPress files and database persist in `~/.wordpress-playground/sites/<path-hash>/`. Changes survive between CLI restarts.
- **Full WordPress directory or explicit `/wordpress` mount**: Automatic persistence in `~/.wordpress-playground/sites/<path-hash>/` is skipped. The mounted WordPress directory is the persistent store. -->

- **डिफ़ॉल्ट (WordPress रूट का कोई माउंट नहीं)**: WordPress फ़ाइलें और डेटाबेस `~/.wordpress-playground/sites/<path-hash>/` में सहेजे रहते हैं। CLI को दोबारा शुरू करने पर भी बदलाव बने रहते हैं।
- **पूरी WordPress डायरेक्टरी या `/wordpress` पर किया गया स्पष्ट माउंट**: `~/.wordpress-playground/sites/<path-hash>/` में अपने-आप सहेजना छोड़ दिया जाता है। माउंट की गई WordPress डायरेक्टरी ही साइट को सहेजकर रखती है।

<!-- The database location depends on your configuration: -->

डेटाबेस की जगह आपके कॉन्फ़िगरेशन पर निर्भर करती है:

<!-- - **Default (automatic persistence)**:
    - Database directory: `~/.wordpress-playground/sites/<path-hash>/wp-content/database/`
    - **Persisted automatically** between sessions
- **Full WordPress directory or explicit `/wordpress` mount**:
    - Database: Follows the mounted WordPress directory
    - **Persisted in that mounted directory** -->

- **डिफ़ॉल्ट (अपने-आप सहेजना)**:
    - डेटाबेस डायरेक्टरी: `~/.wordpress-playground/sites/<path-hash>/wp-content/database/`
    - एक सेशन से दूसरे सेशन तक **अपने-आप सहेजा जाता है**
- **पूरी WordPress डायरेक्टरी या `/wordpress` पर किया गया स्पष्ट माउंट**:
    - डेटाबेस: माउंट की गई WordPress डायरेक्टरी के साथ रहता है
    - **उसी माउंट की गई डायरेक्टरी में सहेजा जाता है**

<!-- #### Resetting a persisted site -->

#### सहेजी गई साइट को रीसेट करना {#resetting-a-persisted-site}

<!-- To start fresh, use the `--reset` flag with the `start` command: -->

नए सिरे से शुरू करने के लिए `start` कमांड के साथ `--reset` फ़्लैग का उपयोग करें:

```bash
npx @wp-playground/cli@latest start --reset
```

<!-- Use `--reset` when: -->

इन स्थितियों में `--reset` का उपयोग करें:

<!-- - You want a clean WordPress installation
- You are testing fresh installation scenarios
- Your site data became corrupted or inconsistent -->

- आपको साफ़ WordPress इंस्टॉलेशन चाहिए
- आप नए इंस्टॉलेशन वाली स्थितियों का परीक्षण कर रहे हैं
- आपकी साइट का डेटा खराब या असंगत हो गया है

<div class="callout callout-info">

<!-- The `--reset` flag works only with `start`. The `server` command keeps the site in a temporary directory that is removed after the server stops. If you mount your own `/wordpress` directory, delete or restore that directory manually. -->

सिर्फ़ `start` कमांड के साथ `--reset` फ़्लैग काम करता है। `server` कमांड साइट को एक अस्थायी डायरेक्टरी में रखती है, जो सर्वर रुकने के बाद हटा दी जाती है। अगर आप अपनी खुद की `/wordpress` डायरेक्टरी माउंट करते हैं, तो उसे मैन्युअल रूप से हटाएँ या रीस्टोर करें।

</div>

<!-- ## Migrating from wp-now -->

## wp-now से माइग्रेट करना {#migrating-from-wp-now}

<!-- The deprecated `@wp-now/wp-now` package maps most directly to the `start`
command: -->

अप्रचलित `@wp-now/wp-now` पैकेज सबसे सीधे तौर पर `start` कमांड से मेल खाता है:

| wp-now                                                  | Playground CLI                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `npx @wp-now/wp-now start`                              | `npx @wp-playground/cli@latest start`                              |
| `npx @wp-now/wp-now start --path=./plugin`              | `cd ./plugin && npx @wp-playground/cli@latest start`               |
| `npx @wp-now/wp-now start --wp=6.8 --php=8.3`           | `npx @wp-playground/cli@latest start --wp=6.8 --php=8.3`           |
| `npx @wp-now/wp-now start --blueprint=./blueprint.json` | `npx @wp-playground/cli@latest start --blueprint=./blueprint.json` |
| `npx @wp-now/wp-now start --skip-browser`               | `npx @wp-playground/cli@latest start --skip-browser`               |
| `npx @wp-now/wp-now start --reset`                      | `npx @wp-playground/cli@latest start --reset`                      |

<!-- The main workflow change is where the saved site lives: -->

वर्कफ़्लो में मुख्य बदलाव यह है कि सहेजी गई साइट कहाँ रहती है:

<!-- - With `wp-now`, `--path=./plugin` picked the project and the saved site.
- With Playground CLI, `start` saves the site for the current directory. For
  the closest match, `cd` into the project first, then run `start`.
- When Playground CLI creates WordPress for you, it keeps the WordPress files
  in `~/.wordpress-playground/sites/<path-hash>/`.
- If you run it on a full WordPress directory, or mount a directory at
  `/wordpress`, that directory is the WordPress site. Changes are written
  there.
- `start --path=./plugin` still mounts that folder, but it does not make
  `./plugin` the saved site. The saved site still belongs to the directory
  where you ran the command. -->

- पहले `wp-now` में `--path=./plugin` से प्रोजेक्ट और सहेजी गई साइट, दोनों चुनी जाती थीं।
- Playground CLI में `start` मौजूदा डायरेक्टरी के लिए साइट सहेजता है। सबसे मिलते-जुलते व्यवहार के लिए पहले `cd` करके प्रोजेक्ट में जाएँ, फिर `start` चलाएँ।
- जब Playground CLI आपके लिए WordPress बनाता है, तो WordPress फ़ाइलें `~/.wordpress-playground/sites/<path-hash>/` में रखता है।
- अगर आप इसे पूरी WordPress डायरेक्टरी पर चलाते हैं, या किसी डायरेक्टरी को `/wordpress` पर माउंट करते हैं, तो वही डायरेक्टरी WordPress साइट होती है। बदलाव वहीं लिखे जाते हैं।
- `start --path=./plugin` अब भी उस फ़ोल्डर को माउंट करता है, लेकिन `./plugin` को सहेजी गई साइट नहीं बनाता। सहेजी गई साइट अब भी उसी डायरेक्टरी की रहती है, जहाँ आपने कमांड चलाई थी।

<!-- Use `start` for the familiar wp-now-style flow. Use `server` only when you want
to spell out mounts, storage, or automation yourself. -->

जाने-पहचाने wp-now जैसे फ़्लो के लिए `start` का उपयोग करें। `server` का उपयोग तभी करें, जब आप माउंट, स्टोरेज या ऑटोमेशन खुद तय करना चाहते हों।

<!-- ## Command and Arguments -->

## कमांड और आर्गुमेंट {#command-and-arguments}

<!-- Playground CLI is simple and configurable. You can set it up according
to your unique WordPress setup. With the Playground CLI, you can use the following top-level commands: -->

Playground CLI सरल है और इसे कॉन्फ़िगर किया जा सकता है। आप इसे अपने खास WordPress सेटअप के हिसाब से सेट कर सकते हैं। Playground CLI में आप नीचे दी गई टॉप-लेवल कमांड का उपयोग कर सकते हैं:

<!-- - **`start`**: (Simplified) Starts a local WordPress server with automatic project detection, site persistence, and browser opening.
- **`server`**: (Advanced) Starts a local WordPress server with full manual control over configuration.
- **`run-blueprint`**: Executes a Blueprint file without starting a web server.
- **`build-snapshot`**: Builds a ZIP snapshot of a WordPress site based on a Blueprint.
- **`php`**: Runs a PHP script or command in the Playground PHP runtime. -->

- **`start`**: (सरल) प्रोजेक्ट की अपने-आप पहचान, साइट को सहेजने और ब्राउज़र खोलने की सुविधा के साथ लोकल WordPress सर्वर शुरू करता है।
- **`server`**: (उन्नत) कॉन्फ़िगरेशन पर पूरे मैन्युअल नियंत्रण के साथ लोकल WordPress सर्वर शुरू करता है।
- **`run-blueprint`**: वेब सर्वर शुरू किए बिना ब्लूप्रिंट फ़ाइल चलाता है।
- **`build-snapshot`**: ब्लूप्रिंट के आधार पर WordPress साइट का ZIP स्नैपशॉट बनाता है।
- **`php`**: Playground के PHP रनटाइम में कोई PHP स्क्रिप्ट या कमांड चलाता है।

<!-- The `start` command supports these common optional arguments. Run
`npx @wp-playground/cli@latest start --help` for the full list: -->

आगे दिए गए आम वैकल्पिक आर्गुमेंट `start` कमांड में उपलब्ध हैं। पूरी सूची के लिए `npx @wp-playground/cli@latest start --help` चलाएँ:

<!-- - `--path=<path>`: Path to the project directory. Defaults to the current working directory.
- `--wp=<version>`: WordPress version to use. Defaults to the latest.
- `--php=<version>`: PHP version to use. Defaults to PHP 8.3.
- `--port=<port>`: The port number for the server to listen on. Defaults to 9400 when available.
- `--blueprint=<path>`: The Blueprint to execute: a local `.json` file, a `.zip` bundle, a directory that contains `blueprint.json`, or an http(s) URL.
- `--login`: Automatically log the user in as an administrator. Defaults to true.
- `--skip-browser`: Do not open the site in your default browser.
- `--reset`: Delete the stored site and start fresh. Defaults to false.
- `--no-auto-mount`: Disable automatic project detection.
- `--codespaces-public-port`: In GitHub Codespaces, make the forwarded port public so anyone with the URL can open the site without signing in to GitHub. Ports stay private by default. Turns off the default auto-login unless you also pass `--login`. -->

- `--path=<path>`: प्रोजेक्ट डायरेक्टरी का पाथ। डिफ़ॉल्ट रूप से मौजूदा वर्किंग डायरेक्टरी।
- `--wp=<version>`: उपयोग किया जाने वाला WordPress संस्करण। डिफ़ॉल्ट रूप से नवीनतम।
- `--php=<version>`: उपयोग किया जाने वाला PHP संस्करण। डिफ़ॉल्ट रूप से PHP 8.3।
- `--port=<port>`: वह पोर्ट नंबर, जिस पर सर्वर सुनेगा। उपलब्ध होने पर डिफ़ॉल्ट रूप से 9400।
- `--blueprint=<path>`: चलाया जाने वाला ब्लूप्रिंट: एक लोकल `.json` फ़ाइल, एक `.zip` बंडल, `blueprint.json` वाली डायरेक्टरी, या कोई http(s) URL।
- `--login`: यूज़र को अपने-आप एडमिनिस्ट्रेटर के रूप में लॉग इन करता है। डिफ़ॉल्ट रूप से true।
- `--skip-browser`: साइट को आपके डिफ़ॉल्ट ब्राउज़र में नहीं खोलता।
- `--reset`: सहेजी गई साइट को हटाकर नए सिरे से शुरू करता है। डिफ़ॉल्ट रूप से false।
- `--no-auto-mount`: प्रोजेक्ट की अपने-आप पहचान बंद करता है।
- `--codespaces-public-port`: GitHub Codespaces में फ़ॉरवर्ड किए गए पोर्ट को सार्वजनिक बनाता है, ताकि URL वाला कोई भी व्यक्ति GitHub में साइन इन किए बिना साइट खोल सके। डिफ़ॉल्ट रूप से पोर्ट निजी रहते हैं। जब तक आप `--login` भी न दें, यह डिफ़ॉल्ट ऑटो-लॉगिन बंद कर देता है।

<!-- The `server` command supports these common optional arguments. Run `npx @wp-playground/cli@latest server --help` for the full list: -->

आगे दिए गए आम वैकल्पिक आर्गुमेंट `server` कमांड में उपलब्ध हैं। पूरी सूची के लिए `npx @wp-playground/cli@latest server --help` चलाएँ:

<!-- - `--port=<port>`: The port number for the server to listen on. Defaults to 9400 when available.
- `--codespaces-public-port`: In GitHub Codespaces, make the forwarded port public so anyone with the URL can open the site without signing in to GitHub. Ports stay private by default. ⚠️ Combined with `--login`, every visitor is signed in as an administrator and can change mounted files.
- `--version`: Show version number.
- `--site-url=<url>`: Site URL to use for WordPress. Defaults to `http://127.0.0.1:{port}`.
- `--wp=<version>`: The version of WordPress to use. Defaults to the latest.
- `--php=<version>`: PHP version to use. Choices: `8.5`, `8.4`, `8.3`, `8.2`, `8.1`, `8.0`, `7.4`, `5.2`. Defaults to `8.3`.
- `--auto-mount[=<path>]`: Automatically mount a directory. If no path is provided, mounts the current working directory. You can mount a WordPress directory, a plugin directory, a theme directory, a wp-content directory, or any directory containing PHP and HTML files.
- `--mount=<mapping>`: Manually mount a directory (can be used multiple times). Format: `"/host/path:/vfs/path"`.
- `--mount-before-install`: Mount a directory to the PHP runtime before WordPress installation (can be used multiple times). Format: `"/host/path:/vfs/path"`.
- `--mount-dir`: Mount a directory to the PHP runtime (can be used multiple times). Format: `"/host/path"` `"/vfs/path"`.
- `--mount-dir-before-install`: Mount a directory before WordPress installation (can be used multiple times). Format: `"/host/path"` `"/vfs/path"`.
- `--blueprint=<path>`: The Blueprint to execute: a local `.json` file, a `.zip` bundle, a directory that contains `blueprint.json`, or an http(s) URL.
- `--blueprint-may-read-adjacent-files`: Consent flag: Allow "bundled" resources in a local blueprint to read files in the same directory as the blueprint file.
- `--login`: Automatically log the user in as an administrator.
- `--wordpress-install-mode=<mode>`: Control how Playground prepares WordPress before booting. Defaults to `download-and-install`. Other options: `install-from-existing-files` (install using files you've mounted), `install-from-existing-files-if-needed` (skip setup when an existing site is detected), and `do-not-attempt-installing` (never download or install WordPress).
- `--skip-sqlite-setup`: Do not set up the SQLite database integration.
- `--verbosity=<level>`: Output logs and progress messages. Choices: `quiet`, `normal`, `debug`. Defaults to `normal`.
- `--debug`: Deprecated. Use `--verbosity=debug` instead.
- `--follow-symlinks`: Allow Playground to follow symlinks by automatically mounting symlinked directories and files encountered in mounted directories.
- `--internal-cookie-store`: Enable internal cookie handling. When enabled, Playground will manage cookies internally using an HttpCookieStore that persists cookies across requests. When disabled, cookies are handled externally (e.g., by a browser in Node.js environments). Defaults to false.
- `--phpmyadmin[=<path>]`: Install phpMyAdmin for database management. The phpMyAdmin URL will be printed after boot. Optionally specify a custom URL path (default: `/phpmyadmin`).
- `--xdebug`: Enable Xdebug. Defaults to false.
- `--php-extension=<manifest>`: Load a PHP.wasm extension manifest before PHP starts. Accepts local paths, `file:` URLs, and HTTP(S) URLs. Can be used multiple times.
- `--experimental-devtools`: Enable experimental browser development tools. Defaults to false.
- `--experimental-unsafe-ide-integration=<ide>`: Set up the Xdebug integration on VS Code (`vscode`) and PhpStorm (`phpstorm`). Pass no value to set up both. Works only with `--xdebug` on PHP versions below 8.5, and cannot be combined with `--experimental-devtools`. It edits your IDE config files, so back them up first.
- `--workers=<n|auto>`: Number of request-handling worker threads. Pass a positive integer, or `auto` to use one worker per CPU core (minus one). Defaults to `min(6, cpus-1)`. Useful for multi-client workloads (e.g. parallel e2e suites) that need more than 6 in-flight requests.
- `--experimental-multi-worker=<number>`: Deprecated. Use `--workers=<n|auto>` instead. The value of this flag is ignored. -->

- `--port=<port>`: वह पोर्ट नंबर, जिस पर सर्वर सुनेगा। उपलब्ध होने पर डिफ़ॉल्ट रूप से 9400।
- `--codespaces-public-port`: GitHub Codespaces में फ़ॉरवर्ड किए गए पोर्ट को सार्वजनिक बनाता है, ताकि URL वाला कोई भी व्यक्ति GitHub में साइन इन किए बिना साइट खोल सके। डिफ़ॉल्ट रूप से पोर्ट निजी रहते हैं। ⚠️ `--login` के साथ मिलाने पर हर विज़िटर एडमिनिस्ट्रेटर के रूप में साइन इन हो जाता है और माउंट की गई फ़ाइलें बदल सकता है।
- `--version`: संस्करण संख्या दिखाता है।
- `--site-url=<url>`: WordPress के लिए उपयोग होने वाला साइट URL। डिफ़ॉल्ट रूप से `http://127.0.0.1:{port}`।
- `--wp=<version>`: उपयोग किया जाने वाला WordPress संस्करण। डिफ़ॉल्ट रूप से नवीनतम।
- `--php=<version>`: उपयोग किया जाने वाला PHP संस्करण। विकल्प: `8.5`, `8.4`, `8.3`, `8.2`, `8.1`, `8.0`, `7.4`, `5.2`। डिफ़ॉल्ट रूप से `8.3`।
- `--auto-mount[=<path>]`: किसी डायरेक्टरी को अपने-आप माउंट करता है। कोई पाथ न देने पर मौजूदा वर्किंग डायरेक्टरी माउंट होती है। आप WordPress डायरेक्टरी, प्लगइन डायरेक्टरी, थीम डायरेक्टरी, wp-content डायरेक्टरी या PHP और HTML फ़ाइलों वाली कोई भी डायरेक्टरी माउंट कर सकते हैं।
- `--mount=<mapping>`: किसी डायरेक्टरी को मैन्युअल रूप से माउंट करता है (कई बार उपयोग किया जा सकता है)। फ़ॉर्मैट: `"/host/path:/vfs/path"`।
- `--mount-before-install`: WordPress इंस्टॉलेशन से पहले किसी डायरेक्टरी को PHP रनटाइम में माउंट करता है (कई बार उपयोग किया जा सकता है)। फ़ॉर्मैट: `"/host/path:/vfs/path"`।
- `--mount-dir`: किसी डायरेक्टरी को PHP रनटाइम में माउंट करता है (कई बार उपयोग किया जा सकता है)। फ़ॉर्मैट: `"/host/path"` `"/vfs/path"`।
- `--mount-dir-before-install`: WordPress इंस्टॉलेशन से पहले किसी डायरेक्टरी को माउंट करता है (कई बार उपयोग किया जा सकता है)। फ़ॉर्मैट: `"/host/path"` `"/vfs/path"`।
- `--blueprint=<path>`: चलाया जाने वाला ब्लूप्रिंट: एक लोकल `.json` फ़ाइल, एक `.zip` बंडल, `blueprint.json` वाली डायरेक्टरी, या कोई http(s) URL।
- `--blueprint-may-read-adjacent-files`: सहमति फ़्लैग: लोकल ब्लूप्रिंट के "बंडल किए गए" रिसोर्स को ब्लूप्रिंट फ़ाइल वाली डायरेक्टरी की फ़ाइलें पढ़ने देता है।
- `--login`: यूज़र को अपने-आप एडमिनिस्ट्रेटर के रूप में लॉग इन करता है।
- `--wordpress-install-mode=<mode>`: तय करता है कि बूट होने से पहले Playground WordPress को कैसे तैयार करे। डिफ़ॉल्ट रूप से `download-and-install`। दूसरे विकल्प: `install-from-existing-files` (आपकी माउंट की गई फ़ाइलों का उपयोग करके स्थापित करता है), `install-from-existing-files-if-needed` (मौजूदा साइट मिलने पर सेटअप छोड़ देता है) और `do-not-attempt-installing` (WordPress को कभी डाउनलोड या स्थापित नहीं करता)।
- `--skip-sqlite-setup`: SQLite डेटाबेस इंटीग्रेशन सेट अप नहीं करता।
- `--verbosity=<level>`: लॉग और प्रगति संदेश दिखाता है। विकल्प: `quiet`, `normal`, `debug`। डिफ़ॉल्ट रूप से `normal`।
- `--debug`: अप्रचलित। इसकी जगह `--verbosity=debug` का उपयोग करें।
- `--follow-symlinks`: माउंट की गई डायरेक्टरी में मिलने वाली सिमलिंक वाली डायरेक्टरी और फ़ाइलों को अपने-आप माउंट करके Playground को सिमलिंक फ़ॉलो करने देता है।
- `--internal-cookie-store`: इंटरनल कुकी हैंडलिंग चालू करता है। चालू होने पर Playground एक HttpCookieStore का उपयोग करके कुकी को अंदर ही संभालता है, जो कुकी को एक रिक्वेस्ट से दूसरी रिक्वेस्ट तक बनाए रखता है। बंद होने पर कुकी बाहर से संभाली जाती हैं (जैसे Node.js एनवायरनमेंट में किसी ब्राउज़र द्वारा)। डिफ़ॉल्ट रूप से false।
- `--phpmyadmin[=<path>]`: डेटाबेस प्रबंधन के लिए phpMyAdmin स्थापित करता है। बूट के बाद phpMyAdmin का URL दिखाया जाएगा। चाहें तो कोई कस्टम URL पाथ दें (डिफ़ॉल्ट: `/phpmyadmin`)।
- `--xdebug`: Xdebug चालू करता है। डिफ़ॉल्ट रूप से false।
- `--php-extension=<manifest>`: PHP शुरू होने से पहले PHP.wasm एक्सटेंशन का मैनिफ़ेस्ट लोड करता है। लोकल पाथ, `file:` URL और HTTP(S) URL स्वीकार करता है। कई बार उपयोग किया जा सकता है।
- `--experimental-devtools`: प्रायोगिक ब्राउज़र डेवलपमेंट टूल चालू करता है। डिफ़ॉल्ट रूप से false।
- `--experimental-unsafe-ide-integration=<ide>`: VS Code (`vscode`) और PhpStorm (`phpstorm`) में Xdebug इंटीग्रेशन सेट अप करता है। दोनों सेट अप करने के लिए कोई वैल्यू न दें। यह सिर्फ़ `--xdebug` के साथ 8.5 से पुराने PHP संस्करणों पर काम करता है, और इसे `--experimental-devtools` के साथ नहीं मिलाया जा सकता। यह आपकी IDE की कॉन्फ़िग फ़ाइलें बदलता है, इसलिए पहले उनका बैकअप ले लें।
- `--workers=<n|auto>`: रिक्वेस्ट संभालने वाले वर्कर थ्रेड की संख्या। कोई धनात्मक पूर्णांक दें, या `auto` दें, ताकि हर CPU कोर के लिए एक वर्कर (कुल में से एक कम) उपयोग हो। डिफ़ॉल्ट रूप से `min(6, cpus-1)`। ऐसे मल्टी-क्लाइंट वर्कलोड (जैसे समानांतर e2e सुइट) के लिए उपयोगी, जिन्हें एक साथ 6 से ज़्यादा रिक्वेस्ट चलानी होती हैं।
- `--experimental-multi-worker=<number>`: अप्रचलित। इसकी जगह `--workers=<n|auto>` का उपयोग करें। इस फ़्लैग की वैल्यू को अनदेखा किया जाता है।

<div class="callout callout-warning">

<!-- With `--follow-symlinks`, Playground follows symlinks, which can expose files outside mounted directories and could be a security risk. -->

जब `--follow-symlinks` दिया जाता है, तो Playground सिमलिंक फ़ॉलो करता है, जिससे माउंट की गई डायरेक्टरी के बाहर की फ़ाइलें उजागर हो सकती हैं और यह सुरक्षा जोखिम हो सकता है।

</div>

<!-- ### Loading PHP.wasm extensions -->

### PHP.wasm एक्सटेंशन लोड करना {#loading-phpwasm-extensions}

<!-- Playground CLI can load external PHP.wasm extensions before PHP starts. Pass a
manifest produced by `@php-wasm/compile-extension`, or a published manifest such
as the SQLite Database Integration native parser: -->

Playground CLI, PHP शुरू होने से पहले बाहरी PHP.wasm एक्सटेंशन लोड कर सकता है। `@php-wasm/compile-extension` से बना मैनिफ़ेस्ट दें, या कोई प्रकाशित मैनिफ़ेस्ट, जैसे SQLite Database Integration का नेटिव पार्सर:

```bash
npx @wp-playground/cli@latest server \
	--php=8.5 \
	--php-extension=https://wordpress.github.io/sqlite-database-integration/wp_mysql_parser-wasm-extension/latest/manifest.json \
	--blueprint=https://wordpress.github.io/sqlite-database-integration/blueprint.json
```

<!-- For local development, point the flag at a local manifest: -->

लोकल डेवलपमेंट के लिए फ़्लैग में किसी लोकल मैनिफ़ेस्ट का पाथ दें:

```bash
npx @wp-playground/cli@latest server \
	--php=8.5 \
	--php-extension=./dist/wp_mysql_parser/manifest.json
```

<!-- `--php-extension` is repeatable. The manifest selects the `.so` artifact
matching the active PHP version and can also stage sidecar files, `.ini`
settings, and environment variables before startup. -->

`--php-extension` कई बार दिया जा सकता है। मैनिफ़ेस्ट सक्रिय PHP संस्करण से मेल खाने वाला `.so` आर्टिफ़ैक्ट चुनता है, और शुरू होने से पहले साइडकार फ़ाइलें, `.ini` सेटिंग्स और एनवायरनमेंट वेरिएबल भी तैयार कर सकता है।

<!-- External extensions are JSPI side modules. If your Node.js build does not expose
JSPI, the CLI rejects the extension request during startup. Use a Node.js build
with JSPI support when testing custom extensions locally. -->

बाहरी एक्सटेंशन JSPI साइड मॉड्यूल होते हैं। अगर आपके Node.js बिल्ड में JSPI उपलब्ध नहीं है, तो CLI शुरू होते समय एक्सटेंशन की रिक्वेस्ट अस्वीकार कर देता है। कस्टम एक्सटेंशन का लोकल परीक्षण करते समय JSPI सपोर्ट वाले Node.js बिल्ड का उपयोग करें।

<!-- See [Loading PHP extensions](/developers/apis/javascript-api/php-extensions)
and
[Building PHP extensions](/developers/apis/javascript-api/build-php-extensions)
for manifest format, compiler helpers, and dependency notes. -->

मैनिफ़ेस्ट फ़ॉर्मैट, कंपाइलर हेल्पर और डिपेंडेंसी से जुड़ी जानकारी के लिए [PHP एक्सटेंशन लोड करना](/developers/apis/javascript-api/php-extensions) और [PHP एक्सटेंशन बनाना](/developers/apis/javascript-api/build-php-extensions) देखें।

<!-- ## Need some help with the CLI? -->

## CLI के साथ मदद चाहिए? {#need-some-help-with-the-cli}

<!-- With the Playground CLI, you can use the `--help` flag to get the full list of available commands and arguments. -->

Playground CLI में उपलब्ध कमांड और आर्गुमेंट की पूरी सूची पाने के लिए आप `--help` फ़्लैग का उपयोग कर सकते हैं।

```bash
npx @wp-playground/cli@latest --help
```

<!-- To see the options of a single command, add `--help` after the command name: -->

किसी एक कमांड के विकल्प देखने के लिए कमांड के नाम के बाद `--help` जोड़ें:

```bash
npx @wp-playground/cli@latest server --help
```

<!-- ## Programmatic usage -->

## प्रोग्रामैटिक उपयोग {#programmatic-usage}

<!-- The Playground CLI can also be controlled programmatically from JavaScript/TypeScript
using the `runCLI` function. See the [Programmatic Usage guide](/guides/programmatic-playground-cli)
for details on automation and testing. -->

Playground CLI को `runCLI` फ़ंक्शन का उपयोग करके JavaScript/TypeScript से प्रोग्राम के ज़रिए भी नियंत्रित किया जा सकता है। ऑटोमेशन और परीक्षण की जानकारी के लिए [प्रोग्रामैटिक उपयोग की मार्गदर्शिका](/guides/programmatic-playground-cli) देखें।
