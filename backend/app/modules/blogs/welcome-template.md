{% if tagline %}*{{ tagline }}*

{% endif %}
{% if category %}
This is the home of **{{ blog_name }}** — a publication focused on **{{ category }}**. Pull up a chair.
{% else %}
This is the home of **{{ blog_name }}**. Pull up a chair.
{% endif %}

Your blog is live. This post was created automatically when you completed setup — feel free to edit it, use it as a template for your first real article, or delete it entirely.

---

## What you can do now

**Write your first real post**
Head to **Posts → New Post** in your dashboard. Write in Markdown with a live preview, add a featured image, assign tags, and publish instantly or schedule for later.

**Invite your team**
Go to **Team** in your dashboard to add editors, authors, or contributors. Each role has scoped permissions so the right people have the right access.
{% if workspace_type == "Agency" or workspace_type == "Client Blogs" %}

As an agency, you can manage multiple client workspaces from a single account — each with its own team, settings, and content.
{% endif %}

**Customise your workspace**
Visit **Settings → Branding** to upload your logo, set your colour scheme, and make the publication feel like yours. Custom domains are available on the Pro plan.

**Explore the API**
Your blog is headless — all content is accessible via the REST API. Find your API key under **Settings → API** and start building your frontend or integrating with other tools.

---

Happy publishing.

---

*Powered by [INKO](https://inko.blog)*