---
name: playground.wordpress.net - Issues
about: Something did not work as expected in the online version of Playground?
title: 'Playground Online: Report an issue with playground.wordpress.net'
labels: bug
assignees: ''

---

## Describe the bug
<--! What did you encounter that seems to be broken? -->

## What protocol is used with the blueprint?
Query API: https://wordpress.github.io/wordpress-playground/apis-overview#query-api
JavaScript API: https://wordpress.github.io/wordpress-playground/apis-overview#javascript-api
PR Previewer - Look in `./testing/PROP.md` for more info


## Blueprint or no?
Did you send a custom blueprint to the instance, or just boot up as-is?
<!-- 

Yes, I used a custom blueprint: 
- link to blueprint URL (GitHub, SVN, publicly accessible link)
- or replace these lines with Blueprint code attached from below

No - I went to a URL pointing to a fragment on playground.wordpress.net 
If you didn't use a custom blueprint: 
- write no custom blueprint and
- explain user flow for how you got to this link
- Please link to the Issue, Pull Request, or discussion around the link with fragment


-->

## paste blueprint as `JSON` code below
The best practice is to copy directly from the code editor, this will retain formatting and readibility in most cases. 

If there are formatting issues, you can use a `JSON` code formatter like https://jsonformatter.org/
Please copy/paste your blueprint from a code editor, which will retain spacing

Once copy pasted below, you can delete all of these instructions. 
It should be just the the `JSON` code directly below the bold sub-section above.
<!--

```JSON

```

-->

If you chose **No** above - you did not have a blueprint...
Please delete the entire previous section to help keep the issue clean.


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
You can use the [Site Health](site-health.md) Check screen to 
 - submit WordPress environment info
 - submit local system info

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