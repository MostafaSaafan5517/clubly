import { expect } from "@playwright/test";

// Local Supabase sends every email to Mailpit instead of a real inbox (see supabase/config.toml).
const MAILPIT_URL = "http://127.0.0.1:54324";

type MailpitSearch = { messages: { ID: string }[] };
type MailpitMessage = { HTML: string };

async function findLink(recipient: string, path: string) {
  const query = encodeURIComponent(`to:"${recipient}"`);
  const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`);
  const { messages } = (await search.json()) as MailpitSearch;
  const latest = messages[0];
  if (!latest) return undefined;

  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`);
  const { HTML } = (await response.json()) as MailpitMessage;
  const href = [...HTML.matchAll(/href="([^"]+)"/g)]
    .map((match) => match[1]?.replaceAll("&amp;", "&"))
    .find((link) => link?.includes(path));
  return href;
}

/** Waits for the latest email to `recipient` and returns its link containing `path`. */
export async function getEmailLink(recipient: string, path: string) {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        link = await findLink(recipient, path);
        return link;
      },
      { message: `email to ${recipient} with a ${path} link`, timeout: 15_000 },
    )
    .toBeDefined();
  if (!link) throw new Error(`No ${path} link emailed to ${recipient}`);
  return link;
}
