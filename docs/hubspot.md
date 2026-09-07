# HubSpot

Queues are **lists / segments**. They are not Contacts saved **views**.

A view URL looks like `/contacts/{portal}/objects/0-1/views/{id}/list`. There is no public Views API. **Create list** from that view. A real list URL has `objectLists` or `lists` in the path.

This app searches lists with `POST /crm/v3/lists/search` and reads contacts with the CRM contacts API.

## Private app

Create one at `https://app.hubspot.com/private-apps/{portalId}`.

| Scope | Why |
|---|---|
| `crm.objects.contacts.read` | Name, title, company, phone, email |
| `crm.lists.read` | Queue picker |
| `crm.lists.write` | Optional. Only if you want CLI/MCP to create segments |
| `crm.objects.calls.write` | Optional. This repo does not log engagements yet |

Paste the token as `HUBSPOT_ACCESS_TOKEN`. If that is unset, the server will try `~/.hscli/config.yml` (`hs` CLI). Do not import HubSpot helpers from a client component.

Mapped contact properties: `firstname`, `lastname`, `email`, `phone` / `mobilephone`, `jobtitle`, `company`.

## Test queues

Two synthetic queues always appear (`test-finn`, `test-brison`) so the desk works before CRM is wired. Overlay phone/email with `OHC_TEST_*` and `OHC_BRISON_*`. Empty those env vars if you do not want overlays on matching HubSpot emails.

## What will not show

A Contacts index view, a report, or a filtered grid that was never saved as a **list**. If the picker is empty, the token cannot read lists, or the portal has none.
