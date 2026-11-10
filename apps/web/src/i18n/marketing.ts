import type { Locale } from "@/i18n/config";

/** Self-service withdrawal of marketing consent for people who only sent an inquiry (no account). */
const bg = {
  eyebrow: "Маркетингови съобщения",
  title: "Оттегляне на съгласието за маркетингови съобщения",
  lead: "Ако не желаете повече да получавате новини, материали и предложения от A.I. Commerce Studio по имейл, потвърдете оттеглянето. Няма нужда от вход или лични данни.",
  confirm: "Оттеглям съгласието си",
  working: "Изчакайте…",
  doneTitle: "Съгласието е оттеглено",
  done: "Записахме оттеглянето. Няма да ви изпращаме маркетингови съобщения. Запитването ви остава, както е, и ще ви отговорим по него.",
  alreadyTitle: "Съгласието вече е оттеглено",
  already: "Това съгласие вече е оттеглено. Не е необходимо да правите нищо повече.",
  invalidTitle: "Невалиден или изтекъл линк",
  invalid: "Линкът е невалиден, непълен или вече не може да се използва. Отворете го отново от писмото или ни пишете на имейла за контакт и ще оттеглим съгласието ви.",
  error: "Не можахме да запишем оттеглянето. Опитайте отново след малко.",
  tooMany: "Твърде много опити. Опитайте отново по-късно.",
  note: "Оттеглянето не засяга законосъобразността на обработването преди него. Запитването ви не се изтрива.",
};

type MarketingTexts = typeof bg;

const en: MarketingTexts = {
  eyebrow: "Marketing messages",
  title: "Withdraw your consent to marketing messages",
  lead: "If you no longer want to receive news, resources and offers from A.I. Commerce Studio by e-mail, confirm the withdrawal. You do not need to sign in or give any personal data.",
  confirm: "Withdraw my consent",
  working: "Please wait…",
  doneTitle: "Consent withdrawn",
  done: "We recorded the withdrawal. We will not send you marketing messages. Your inquiry stays as it is and we will answer it.",
  alreadyTitle: "Consent already withdrawn",
  already: "This consent was already withdrawn. You do not need to do anything more.",
  invalidTitle: "Invalid or expired link",
  invalid: "The link is invalid, incomplete or can no longer be used. Open it again from the e-mail, or write to the contact e-mail address and we will withdraw your consent.",
  error: "We could not record the withdrawal. Please try again in a moment.",
  tooMany: "Too many attempts. Please try again later.",
  note: "Withdrawing does not affect the lawfulness of processing before it. Your inquiry is not deleted.",
};

export const marketingTexts: Record<Locale, MarketingTexts> = { bg, en };
