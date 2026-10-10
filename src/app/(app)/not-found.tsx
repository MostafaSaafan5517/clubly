import { IconMapSearch } from "@tabler/icons-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageBody } from "@/components/page-body";
import { buttonVariants } from "@/components/ui/button";
import { SIGNED_IN_HOME } from "@/lib/auth";

/**
 * notFound() in a signed-in page: a business that doesn't exist, or one the user isn't staff at
 * (or a page their role can't open). It keeps the signed-in frame; without this file the root
 * not-found would take over and drop it. Like the root one, it never says why. (A nested
 * not-found can't set the title: the page's own stays, which depends only on the address.)
 */
export default function SignedInNotFound() {
  return (
    <PageBody width="narrow">
      <EmptyState
        icon={IconMapSearch}
        title="Page not found"
        titleAs="h1"
        action={
          <Link href={SIGNED_IN_HOME} className={buttonVariants()}>
            Go to your home page
          </Link>
        }
      >
        There&apos;s nothing at this address. Check the link, or start again
        from your home page.
      </EmptyState>
    </PageBody>
  );
}
