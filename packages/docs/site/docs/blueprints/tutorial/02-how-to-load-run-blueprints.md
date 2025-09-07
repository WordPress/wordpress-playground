---
title: How to run Blueprints
slug: /blueprints/tutorial/how-to-load-run-blueprints
description: Learn the various methods for loading and running Blueprints, including using a URL fragment or the blueprint-url parameter.
---

# How to load and run Blueprints

## URL fragment

The fastest way to run Blueprints is to paste one into the URL "fragment" of a WordPress Playground website. Just add a `#` after the `.net/`.

Let's say you want to create a Playground with specific versions of WordPress and PHP using the following Blueprint:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"preferredVersions": {
		"php": "8.3",
		"wp": "5.9"
	}
}
```

To run it, go to `https://playground.wordpress.net/#{"preferredVersions": {"php":"8.3", "wp":"5.9"}}`. You can also use the button below:

[<kbd> &nbsp; Run Blueprint &nbsp; </kbd>](https://playground.wordpress.net/#{"preferredVersions":{"php":"8.3","wp":"5.9"}})

Use this method to run the example code in the next chapter, [**Build your first Blueprint**](/blueprints/tutorial/build-your-first-blueprint).

### Base64 encoded Blueprints

GitHub સહિતના કેટલાક ટૂલ્સ, URL માં પેસ્ટ કરવામાં આવે ત્યારે બ્લુપ્રિન્ટને યોગ્ય રીતે ફોર્મેટ ન પણ કરી શકે. આવા કિસ્સાઓમાં, [તમારા બ્લુપ્રિન્ટને Base64 માં એન્કોડ કરો](https://www.base64encode.org) અને તેને URL માં ઉમેરો. ઉદાહરણ તરીકે, તે Base64 ફોર્મેટમાં ઉપરોક્ત બ્લુપ્રિન્ટ છે: `eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19`.

To run it, go to [https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19](https://playground.wordpress.net/#eyJwcmVmZXJyZWRWZXJzaW9ucyI6IHsicGhwIjoiNy40IiwgIndwIjoiNS45In19)

### Load Blueprint from a URL

When your Blueprint gets too wieldy, you can load it via the `?blueprint-url` query parameter in the URL, like this:

[https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/latest-gutenberg/blueprint.json)

Note that the Blueprint must be publicly accessible and served with [the correct `Access-Control-Allow-Origin` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin):

```
Access-Control-Allow-Origin: *
```
