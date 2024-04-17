---
name: playground.wordpress.net - Issues
about: Something did not work as expected in the online version of Playground?
title: 'Playground Online: Report an issue with playground.wordpress.net'
labels: bug
assignees: ''

---

## Describe the bug
<--! What did you encounter that seems to be broken? -->

## Did you use a blueprint?
<!-- Did you send a custom blueprint to the instance, or click a link? -->

If you used a blueprint, paste it below or paste a link to it

## What protocol is used with the blueprint?
Query API: https://wordpress.github.io/wordpress-playground/apis-overview#query-api
JavaScript API: https://wordpress.github.io/wordpress-playground/apis-overview#javascript-api
PR Previewer - Look in `./testing/PROP.md` for more info

## Journey to reproduce issue
1. Go to '...'
2. Expected
3. What happened
4. See errors - if applicable

## Expected behavior
A clear and concise description of what you expected to happen.

## Screenshots or screencast
If applicable, add screenshots to help explain your problem.

When recording screencasts, try to get around the time the error occurs and showcase both the opening window and the console window in one view. 

Make sure to use Alt tags for screenshots and to identify video flows.

## Error reporting
You can use the [Site Health](https://wordpress.org/documentation/article/site-health-screen/) screen to 
 - submit WordPress environment info
 - submit local system info

In the Playground URL bar, go to `/wp-admin/site-health.php?tab=debug` to access the full debug info for your website

You can use the Playground menu to `Report error`, which will automaticlly send some information and submit to the `#playground-logs` Channel on Making WordPress Slack.


## Include Console errors
<!-- - 
Copy/paste the error into this section 

-->
Please include the error you see in the console in a code block. 

Best practices for console log reporting
- Try to track down to as close as possible where the error is occuring
- If there are multiple errors occuring, show them separately
- It shouldn't be a ton of info per error, just the stack trace
- Include code samples wrapped in `SHELL` code blocks


### SHELL code blocks
<code>\`\`\`SHELL 
{error codes} 
\`\`\`</code>


## Environmental info
<!-- please complete the following information -->
Operating system: `'nix`, `MacOS`, `Windows`, `other`
<!--
   select one from the list above and delete the others
   or include your OS info
   then delete this comment

   change the following info also
-->
   
 - Browser [e.g. chrome, safari]
 - Version [e.g. 22]

**Smartphone (please complete the following information):**
 - Device: [e.g. iPhone6]
 - OS: [e.g. iOS8.1]
 - Browser [e.g. stock browser, safari]
 - Version [e.g. 22]

**Additional context**
Add any other context about the problem here.
- Links to documentation
- Related issues
- screenshots or screen casts relating to issue
