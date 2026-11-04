import type { Locale } from "@/i18n/config";

/** Texts around Stripe Checkout (test mode, behind BILLING_PROVIDER=stripe). */
const bg = {
  title: "План и плащане",
  network: "Няма връзка със сървъра. Опитайте отново.",
  wait: "Изчакайте…",
  status: "Абонамент",
  statuses: {
    active: "активен",
    trialing: "пробен период",
    past_due: "неуспешно плащане",
    unpaid: "неплатен",
    incomplete: "чака потвърждение",
    paused: "спрян",
  },
  actionRequired: "Плащането чака вашето потвърждение. Отворете управлението на абонамента.",
  endsAtPeriodEnd: "Абонаментът приключва в края на платения период.",
  noOffers: "В момента няма планове за покупка.",
  plans: { pro: "Pro", business: "Business", custom: "Custom" },
  oneTime: "Еднократна покупка",
  intervals: { month: "месец", year: "година" },
  scopeFirst: "след потвърден обхват",
  buy: "Продължи към плащане",
  manage: "Управление на абонамента",
  methodsNote: "Плащането е на защитената страница на Stripe. Там виждате методите, налични за вас.",
  paymentTitle: "Плащане",
  paymentLead: "Проверяваме състоянието на плащането.",
  processing: "Обработваме плащането. Планът се сменя, щом плащането бъде потвърдено.",
  confirmed: "Плащането е потвърдено и планът е активен.",
  back: "Към Advisor Workspace",
};

type BillingTexts = typeof bg;

const en: BillingTexts = {
  title: "Plan and payment",
  network: "Could not reach the server. Please try again.",
  wait: "Please wait…",
  status: "Subscription",
  statuses: {
    active: "active",
    trialing: "trial",
    past_due: "payment failed",
    unpaid: "unpaid",
    incomplete: "awaiting confirmation",
    paused: "paused",
  },
  actionRequired: "Your payment needs confirmation. Open subscription management.",
  endsAtPeriodEnd: "Your subscription ends at the end of the paid period.",
  noOffers: "No plans are on sale right now.",
  plans: { pro: "Pro", business: "Business", custom: "Custom" },
  oneTime: "One-time purchase",
  intervals: { month: "month", year: "year" },
  scopeFirst: "after the scope is confirmed",
  buy: "Continue to payment",
  manage: "Manage subscription",
  methodsNote: "You pay on Stripe's secure page, which shows the methods available to you.",
  paymentTitle: "Payment",
  paymentLead: "We're checking the state of your payment.",
  processing: "We're processing your payment. Your plan changes once the payment is confirmed.",
  confirmed: "Your payment is confirmed and your plan is active.",
  back: "Back to Advisor Workspace",
};

export const billingTexts: Record<Locale, BillingTexts> = { bg, en };
