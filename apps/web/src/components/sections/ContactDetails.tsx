import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import { company } from "@/lib/company";

export interface ContactDetailsLabels {
  phone: string;
  email: string;
  /** Accessible names with a `{phone}` / `{email}` placeholder. */
  phoneAria: string;
  emailAria: string;
}

/**
 * The approved company phone and e-mail (lib/company.ts) with visible labels and descriptive
 * accessible names. Used by the contact page, the footer and the founder profile, so a change to
 * the central values reaches all of them.
 */
export function ContactDetails({
  labels,
  align = "start",
  className,
}: {
  labels: ContactDetailsLabels;
  align?: "start" | "end";
  className?: string;
}) {
  const items = [
    {
      key: "phone",
      icon: "phone" as const,
      label: labels.phone,
      href: company.phoneUri,
      value: company.phoneDisplay,
      aria: labels.phoneAria.replace("{phone}", company.phoneDisplay),
    },
    {
      key: "email",
      icon: "mail" as const,
      label: labels.email,
      href: company.contactEmailUri,
      value: company.contactEmail,
      aria: labels.emailAria.replace("{email}", company.contactEmail),
    },
  ];
  return (
    <dl className={cx("grid gap-3 text-sm", align === "end" && "lg:justify-items-end lg:text-right", className)} data-testid="contact-details">
      {items.map((item) => (
        <div key={item.key} className="grid gap-0.5">
          <dt className="t-label">{item.label}</dt>
          <dd>
            <a href={item.href} aria-label={item.aria} className="inline-flex min-h-6 items-center gap-2 break-all text-fg-secondary hover:text-fg">
              <Icon name={item.icon} className="h-4 w-4 shrink-0 text-brand" />
              {item.value}
            </a>
          </dd>
        </div>
      ))}
    </dl>
  );
}
