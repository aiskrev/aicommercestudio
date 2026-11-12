import type { Locale } from "@/i18n/config";

/**
 * Texts of the interactive demonstrations (docs/AI_DEMONSTRATIONS.md). The server answers with codes; this file turns
 * every code into a sentence in both languages (`lib/demo-codes.json` lists them, a test checks none is missing).
 * Nothing here promises a result, a saving or a deadline: a demonstration shows how a process could be designed.
 */
export interface ScenarioText {
  title: string;
  lead: string;
  shows: string[];
  fields: Record<string, { label: string; options: Record<string, string> }>;
}

export interface DemoTexts {
  metaTitle: string;
  eyebrow: string;
  listTitle: string;
  listLead: string;
  open: string;
  badge: string;
  badgeLong: string;
  flowTitle: string;
  steps: Record<string, { title: string; text: string }>;
  statuses: Record<string, string>;
  form: { legend: string; note: string; noteHint: string; run: string; running: string; reset: string };
  empty: string;
  errors: { failed: string; rateLimited: string; invalid: string };
  result: { title: string; executed: string; approvalRequired: string; approvalNotRequired: string; risk: Record<string, string>; riskLabel: string; limitationsTitle: string; nextTitle: string; service: string; packages: string; contact: string };
  shows: string;
  notFor: string[];
  notForTitle: string;
  scenarios: Record<string, ScenarioText>;
  codes: Record<string, string>;
}

const bg: DemoTexts = {
  metaTitle: "Интерактивни демонстрации на AI автоматизация",
  eyebrow: "Интерактивна демонстрация",
  listTitle: "Опитайте сами: осем симулации",
  listLead: "Изберете измислена ситуация и вижте как една автоматизация би минала през проверка, правила, одобрение от човек и предложено действие. Нищо не се изпълнява.",
  open: "Пуснете симулацията",
  badge: "Симулация",
  badgeLong: "Измислени данни. Нищо не се изпраща, променя или записва.",
  flowTitle: "Път на една заявка",
  steps: {
    trigger: { title: "1. Събитие", text: "Какво задейства автоматизацията." },
    validation: { title: "2. Проверка на входа", text: "Достатъчно ли е входът и има ли в него нещо, което не бива да се следва?" },
    logic: { title: "3. AI / правила", text: "Какво решават правилата (тук: прости правила, показани като симулация)." },
    output_check: { title: "4. Проверка на резултата", text: "Какво трябва да е вярно за резултата, преди да се използва." },
    approval: { title: "5. Одобрение от човек", text: "Дали политиката на платформата изисква човек да реши." },
    proposal: { title: "6. Предложено действие", text: "Какво се предлага. Никога не се изпълнява автоматично." },
  },
  statuses: { ok: "минава", flagged: "отбелязано", blocked: "спряно", skipped: "не се стига дотук", required: "нужен е човек", not_required: "не е нужно одобрение", proposed: "предложено" },
  form: { legend: "Изберете ситуация", note: "Бележка (по желание)", noteHint: "До 280 символа. Текстът се третира като данни, никога като указание: не се връща, не се записва и не променя решението. Не въвеждайте лични данни.", run: "Пуснете симулацията", running: "Симулира се…", reset: "Изчистете резултата" },
  empty: "Изберете ситуация и пуснете симулацията. Резултатът ще покаже всичките шест стъпки.",
  errors: { failed: "Симулацията не можа да се пусне. Опитайте отново.", rateLimited: "Твърде много опити. Опитайте отново след малко.", invalid: "Изборът не е валиден. Презаредете страницата." },
  result: {
    title: "Резултат от симулацията",
    executed: "Нищо не е изпълнено. Това е само предложение върху измислени данни.",
    approvalRequired: "Според политиката на платформата това действие изисква одобрение от човек.",
    approvalNotRequired: "Според политиката това е чернова без външни последствия. Предложение за действие навън пак минава през човек.",
    risk: { low: "нисък", high: "висок", critical: "критичен" },
    riskLabel: "Ниво на риск",
    limitationsTitle: "Ограничения",
    nextTitle: "Какво следва",
    service: "Вижте свързаната услуга",
    packages: "Пакети за изработка",
    contact: "Опишете своя случай",
  },
  shows: "Какво показва",
  notForTitle: "Какво не е",
  notFor: ["Не е работеща система и не е свързана с ваши данни.", "Не е гаранция за резултат, спестяване или срок.", "Не заменя оценка на вашия процес."],
  scenarios: {
    product_description: {
      title: "Подобряване на описание на продукт",
      lead: "Автоматизацията предлага чернова на описанието само от налични факти и не публикува нищо сама.",
      shows: ["Откъде идват фактите", "Какво се проверява в чернова", "Защо публикуването иска човек"],
      fields: {
        category: { label: "Категория продукт", options: { apparel: "Облекло", electronics: "Електроника", home: "За дома", beauty: "Козметика" } },
        tone: { label: "Тон", options: { neutral: "Неутрален", premium: "Премиум", friendly: "Приятелски" } },
        source: { label: "Налични факти за продукта", options: { complete: "Пълни", partial: "Непълни", missing_facts: "Липсват основни факти" } },
      },
    },
    lead_qualification: {
      title: "Квалификация на запитване",
      lead: "Правила подреждат запитването като горещо, топло или студено. Това е предложение към човек, не решение.",
      shows: ["Как се събират точки", "Защо резултатът е предложение", "Кой изпраща първия отговор"],
      fields: {
        budget: { label: "Бюджет (посочен от клиента)", options: { none: "Не е посочен", low: "Нисък", mid: "Среден", high: "Висок" } },
        timeline: { label: "Срок", options: { unknown: "Неизвестен", later: "По-късно", quarter: "Тримесечие", urgent: "Спешен" } },
        need: { label: "Яснота на нуждата", options: { vague: "Неясна", clear: "Ясна" } },
      },
    },
    support_routing: {
      title: "Насочване на запитване към поддръжка",
      lead: "Заявката се насочва към опашка. Плащания, акаунти и ядосани клиенти първо се четат от човек.",
      shows: ["Избор на опашка", "Кога човек чете първи", "Маскиране на лични данни"],
      fields: {
        topic: { label: "Тема", options: { shipping: "Доставка", returns: "Връщане", payment: "Плащане", product_question: "Въпрос за продукт", account: "Акаунт" } },
        urgency: { label: "Спешност", options: { low: "Ниска", normal: "Нормална", high: "Висока" } },
        sentiment: { label: "Тон на клиента", options: { calm: "Спокоен", upset: "Недоволен" } },
        personal_data: { label: "Съдържа лични данни", options: { no: "Не", yes: "Да" } },
      },
    },
    order_workflow: {
      title: "Анализ на поръчка",
      lead: "Автоматизацията предлага следваща стъпка по поръчката. Не променя поръчката и не пише на клиента.",
      shows: ["Какво спира една поръчка", "Кога е нужен втори поглед", "Защо промяна на поръчка иска одобрение"],
      fields: {
        value: { label: "Стойност", options: { small: "Малка", medium: "Средна", large: "Голяма" } },
        payment: { label: "Плащане", options: { paid: "Платена", pending: "Чака", failed: "Неуспешно" } },
        address: { label: "Адрес", options: { valid: "Валиден", unclear: "Неясен" } },
        stock: { label: "Наличност", options: { available: "Налична", partial: "Частична", none: "Няма" } },
      },
    },
    inventory_warning: {
      title: "Предупреждение за наличност",
      lead: "При ниска наличност се подготвя заявка за доставчик като чернова. Количеството е посока, не число.",
      shows: ["Ниво на предупреждение", "Посока на заявката", "Защо поръчка към доставчик иска човек"],
      fields: {
        stock: { label: "Наличност", options: { ok: "Достатъчна", low: "Ниска", empty: "Изчерпана" } },
        trend: { label: "Тенденция на продажбите", options: { rising: "Растяща", stable: "Стабилна", falling: "Падаща" } },
        lead_time: { label: "Срок на доставчика", options: { short: "Кратък", long: "Дълъг" } },
      },
    },
    crm_automation: {
      title: "CRM автоматизация",
      lead: "Събитие в CRM създава задача. Без съгласие няма маркетингово съобщение, само вътрешна задача.",
      shows: ["Какво създава задача", "Как се спазва съгласието", "Защо съобщенията са чернови"],
      fields: {
        event: { label: "Събитие", options: { form_submitted: "Изпратена форма", quote_opened: "Отворена оферта", no_reply_7d: "Без отговор 7 дни" } },
        segment: { label: "Клиент", options: { new: "Нов", existing: "Съществуващ" } },
        consent: { label: "Съгласие за маркетинг", options: { yes: "Има", no: "Няма" } },
      },
    },
    quotation_drafting: {
      title: "Чернова на оферта",
      lead: "Структурата на офертата се подготвя като чернова. Цената и гаранциите ги решава човек, не автоматизацията.",
      shows: ["Секциите на една чернова", "Какво никога не влиза в нея", "Кога първо се задават въпроси"],
      fields: {
        service: { label: "Услуга", options: { website: "Бизнес сайт", store: "Онлайн магазин", integration: "Интеграция" } },
        scope: { label: "Яснота на обхвата", options: { clear: "Ясен", partial: "Частичен", vague: "Неясен" } },
      },
    },
    human_approval: {
      title: "Одобрение от човек преди бизнес действие",
      lead: "Политиката на платформата решава кои действия изискват човек. Цена, поръчка и чувствителни данни са критични.",
      shows: ["Кое е нисък и кое критичен риск", "Кога е нужен старши преглед", "Защо нищо не тръгва без одобрение"],
      fields: {
        action: { label: "Предложено действие", options: { message: "Изпращане на съобщение", price_change: "Промяна на цена", refund: "Възстановяване на сума", data_change: "Промяна на чувствителни данни" } },
        amount: { label: "Размер", options: { none: "Няма сума", small: "Малък", large: "Голям" } },
        reversible: { label: "Може ли да се върне", options: { yes: "Да", no: "Не" } },
      },
    },
  },
  codes: {
    access_sensitive_data: "Достъп до чувствителни данни", action_data_change: "Действие: промяна на данни", action_message: "Действие: съобщение", action_price_change: "Действие: промяна на цена", action_refund: "Действие: възстановяване на сума",
    address_unclear: "Адресът е неясен", address_valid: "Адресът е валиден", amount_large: "Голям размер", amount_none: "Без сума", amount_small: "Малък размер",
    approval_critical: "Критичен риск", approval_high: "Висок риск", approval_low: "Нисък риск, без външни последствия",
    assumptions_listed: "Допусканията са изброени", band_cold: "Студено", band_hot: "Горещо", band_is_a_suggestion: "Оценката е предложение към човек", band_warm: "Топло",
    budget_high: "Висок бюджет", budget_low: "Нисък бюджет", budget_mid: "Среден бюджет", budget_none: "Без посочен бюджет", change_price: "Промяна на цена",
    checked: "Входът е проверен: няма забележки", checked_with_flags: "Входът е проверен: има отбелязани неща", consent_no: "Няма съгласие", consent_respected: "Съгласието е спазено", consent_yes: "Има съгласие",
    customer_not_contacted: "Клиентът не е потърсен", decision_is_logged: "Решението се записва", draft_benefits: "Чернова на ползите", draft_headline: "Чернова на заглавие",
    event_form_submitted: "Събитие: изпратена форма", event_no_reply_7d: "Събитие: без отговор 7 дни", event_quote_opened: "Събитие: отворена оферта",
    facts_from_source_only: "Само факти от източника", first_reply_task: "Задача: първи отговор", follow_up_call_task: "Задача: обаждане", gaps_marked_for_review: "Пропуските са отбелязани за преглед",
    generate_draft: "Генериране на чернова", gentle_reminder_task: "Задача: учтиво напомняне", human_reads_first: "Човек чете първи", instruction_like_text: "Бележката прилича на указание: тя се третира като данни и се игнорира",
    large_order_second_look: "Голяма поръчка: втори поглед", lead_time_long: "Дълъг срок на доставчика", lead_time_short: "Кратък срок на доставчика", level_critical: "Ниво: критично", level_warning: "Ниво: предупреждение",
    link_in_text: "Бележката съдържа връзка: не се следва", message_is_a_draft: "Съобщението е чернова", missing_product_facts: "Липсват основни факти за продукта: чернова не се прави", modify_order: "Промяна на поръчка", modify_product: "Промяна на продукт",
    need_clear: "Ясна нужда", need_vague: "Неясна нужда", no_alert_needed: "Не е нужно предупреждение", no_guarantee: "Без гаранции", no_marketing_message_without_consent: "Без маркетингово съобщение при липса на съгласие",
    no_message_to_customer: "Няма съобщение към клиента", no_order_placed_with_supplier: "Няма поръчка към доставчика", no_price_in_the_draft: "Без цена в черновата", no_price_or_promise: "Без цена и обещания", no_promise_to_customer: "Без обещания към клиента",
    no_reply_sent_to_customer: "Няма отговор към клиента", no_unverified_claims: "Без непроверени твърдения", not_advice: "Не е съвет", not_reached: "Не се стига до тази стъпка", nothing_executed: "Нищо не се изпълнява", nothing_runs_before_approval: "Нищо не тръгва преди одобрение",
    order_not_changed: "Поръчката не е променена", output_checked: "Резултатът е проверен", payment_failed: "Плащането е неуспешно", payment_paid: "Платена", payment_pending: "Плащането чака", personal_data_masked: "Личните данни са маскирани",
    personal_detail_in_text: "Бележката съдържа лични данни: не се използват", price_left_to_a_person: "Цената се оставя на човек",
    proposal_ask_customer_for_address: "Да се поиска вярен адрес от клиента", proposal_ask_for_facts: "Да се поискат липсващите факти", proposal_ask_scoping_questions: "Да се зададат въпроси за обхвата", proposal_backorder_options: "Да се предложат варианти при липса на наличност",
    proposal_create_proposal_draft: "Да се създаде чернова на оферта за преглед", proposal_draft_purchase_request: "Да се подготви чернова на заявка към доставчика", proposal_first_reply_task: "Да се създаде задача за първи отговор", proposal_follow_up_call_task: "Да се създаде задача за обаждане",
    proposal_gentle_reminder_task: "Да се създаде задача за учтиво напомняне", proposal_hold_and_ask_customer: "Да се задържи поръчката и да се попита клиентът", proposal_internal_task_only: "Само вътрешна задача", proposal_no_action: "Няма нужда от действие",
    proposal_nurture_later: "Да се върне към запитването по-късно", proposal_owner_reply_this_week: "Отговор от отговорника тази седмица", proposal_owner_reply_today: "Отговор от отговорника днес", proposal_ready_to_ship: "Поръчката може да се подготви за изпращане",
    proposal_route_ticket: "Да се насочи заявката към опашката", proposal_split_shipment_proposal: "Да се предложи разделена доставка", proposal_update_product_draft: "Да се обнови чернова на описанието", proposal_wait_for_approval: "Да се изчака одобрение", proposal_wait_for_payment: "Да се изчака плащане",
    quantity_is_a_direction_not_a_number: "Количеството е посока, не число", queue_account_support: "Опашка: акаунти", queue_exists: "Опашката съществува", queue_logistics: "Опашка: логистика", queue_payments_specialist: "Опашка: специалист по плащания",
    queue_product_team: "Опашка: продуктов екип", queue_returns_desk: "Опашка: връщания", reason_recorded: "Причината е записана", reasons_listed: "Причините са изброени", reorder_increase: "Заявка: повече", reorder_keep: "Заявка: същото", reorder_reduce: "Заявка: по-малко",
    reversible_no: "Не може да се върне", reversible_yes: "Може да се върне", rule_based: "Прости правила, не модел", rules_applied_as_simulation: "Правилата са приложени като симулация", scope_clear: "Ясен обхват", scope_partial: "Частичен обхват", scope_too_vague: "Обхватът е твърде неясен: чернова не се прави",
    secret_like_text: "Бележката прилича на таен ключ или парола: игнорира се", section_assumptions: "Секция: допускания", section_care: "Секция: грижа", section_compatibility: "Секция: съвместимост", section_deliverables: "Секция: какво получавате", section_dimensions: "Секция: размери",
    section_exclusions: "Секция: какво не е включено", section_fit: "Секция: кройка", section_ingredients_source: "Секция: съставки (от източника)", section_material: "Секция: материал", section_milestones: "Секция: етапи", section_scope: "Секция: обхват", section_skin_note: "Секция: бележка за кожата",
    section_specifications: "Секция: спецификации", section_usage: "Секция: употреба", section_warranty_source: "Секция: гаранция (от източника)", segment_existing: "Съществуващ клиент", segment_new: "Нов клиент", send_message: "Изпращане на съобщение", senior_reviewer: "Нужен е старши преглед",
    sentiment_calm: "Спокоен тон", sentiment_upset: "Недоволен тон", service_integration: "Услуга: интеграция", service_store: "Услуга: онлайн магазин", service_website: "Услуга: бизнес сайт", simulated_data: "Измислени данни", stock_available: "Налична", stock_none: "Няма наличност", stock_ok: "Наличността е достатъчна", stock_partial: "Частична наличност",
    timeline_later: "Срок: по-късно", timeline_quarter: "Срок: тримесечие", timeline_unknown: "Неизвестен срок", timeline_urgent: "Спешен срок", tone_friendly: "Приятелски тон", tone_neutral: "Неутрален тон", tone_premium: "Премиум тон", trend_falling: "Падащи продажби", trend_rising: "Растящи продажби", trend_stable: "Стабилни продажби",
    trigger_crm_automation: "Събитие в CRM", trigger_human_approval: "Предложено бизнес действие", trigger_inventory_warning: "Промяна в наличността", trigger_lead_qualification: "Ново запитване", trigger_order_workflow: "Нова поръчка", trigger_product_description: "Продукт със стара или липсваща чернова", trigger_quotation_drafting: "Заявка за оферта", trigger_support_routing: "Ново запитване към поддръжка",
    unsubscribe_included: "Включена е отписване от маркетинг", unsubscribe_not_needed_for_service_message: "Служебно съобщение: не е маркетинг", urgency_high: "Висока спешност", urgency_low: "Ниска спешност", urgency_normal: "Нормална спешност", value_large: "Голяма поръчка", value_medium: "Средна поръчка", value_small: "Малка поръчка", version_kept_for_review: "Версията се пази за преглед",
  },
};

const en: DemoTexts = {
  metaTitle: "Interactive demonstrations of AI automation",
  eyebrow: "Interactive demonstration",
  listTitle: "Try it yourself: eight simulations",
  listLead: "Pick an invented situation and watch how an automation would go through checks, rules, human approval and a proposed action. Nothing is executed.",
  open: "Run the simulation",
  badge: "Simulation",
  badgeLong: "Invented data. Nothing is sent, changed or saved.",
  flowTitle: "The path of one request",
  steps: {
    trigger: { title: "1. Trigger", text: "What starts the automation." },
    validation: { title: "2. Input check", text: "Is the input sufficient, and is there anything in it that must not be followed?" },
    logic: { title: "3. AI / rules", text: "What the rules decide (here: plain rules, shown as a simulation)." },
    output_check: { title: "4. Output check", text: "What must be true of the result before it is used." },
    approval: { title: "5. Human approval", text: "Whether the platform's policy requires a person to decide." },
    proposal: { title: "6. Proposed action", text: "What is proposed. Never executed automatically." },
  },
  statuses: { ok: "passes", flagged: "flagged", blocked: "stopped", skipped: "not reached", required: "a person is needed", not_required: "no approval needed", proposed: "proposed" },
  form: { legend: "Choose a situation", note: "Note (optional)", noteHint: "Up to 280 characters. The text is treated as data, never as an instruction: it is not echoed, not saved and does not change the decision. Do not enter personal details.", run: "Run the simulation", running: "Simulating…", reset: "Clear the result" },
  empty: "Choose a situation and run the simulation. The result shows all six steps.",
  errors: { failed: "The simulation could not be run. Try again.", rateLimited: "Too many attempts. Try again in a moment.", invalid: "The choice is not valid. Reload the page." },
  result: {
    title: "Result of the simulation",
    executed: "Nothing was executed. This is only a proposal on invented data.",
    approvalRequired: "By the platform's policy this action needs approval from a person.",
    approvalNotRequired: "By the policy this is a draft with no outside effect. A proposal to act outside still goes through a person.",
    risk: { low: "low", high: "high", critical: "critical" },
    riskLabel: "Risk level",
    limitationsTitle: "Limitations",
    nextTitle: "What next",
    service: "See the related service",
    packages: "Project packages",
    contact: "Describe your case",
  },
  shows: "What it shows",
  notForTitle: "What it is not",
  notFor: ["It is not a working system and is connected to none of your data.", "It is no guarantee of a result, a saving or a deadline.", "It does not replace an assessment of your process."],
  scenarios: {
    product_description: {
      title: "Improving a product description",
      lead: "The automation proposes a draft of the description from available facts only and publishes nothing by itself.",
      shows: ["Where the facts come from", "What is checked in a draft", "Why publishing needs a person"],
      fields: {
        category: { label: "Product category", options: { apparel: "Apparel", electronics: "Electronics", home: "Home", beauty: "Beauty" } },
        tone: { label: "Tone", options: { neutral: "Neutral", premium: "Premium", friendly: "Friendly" } },
        source: { label: "Facts available about the product", options: { complete: "Complete", partial: "Partial", missing_facts: "Key facts missing" } },
      },
    },
    lead_qualification: {
      title: "Qualifying an enquiry",
      lead: "Rules rank the enquiry as hot, warm or cold. It is a suggestion to a person, not a decision.",
      shows: ["How points add up", "Why the result is a suggestion", "Who sends the first reply"],
      fields: {
        budget: { label: "Budget (stated by the customer)", options: { none: "Not stated", low: "Low", mid: "Medium", high: "High" } },
        timeline: { label: "Timeline", options: { unknown: "Unknown", later: "Later", quarter: "This quarter", urgent: "Urgent" } },
        need: { label: "Clarity of the need", options: { vague: "Vague", clear: "Clear" } },
      },
    },
    support_routing: {
      title: "Routing a support request",
      lead: "The request is routed to a queue. Payments, accounts and upset customers are read by a person first.",
      shows: ["Choosing the queue", "When a person reads first", "Masking personal data"],
      fields: {
        topic: { label: "Topic", options: { shipping: "Shipping", returns: "Returns", payment: "Payment", product_question: "Product question", account: "Account" } },
        urgency: { label: "Urgency", options: { low: "Low", normal: "Normal", high: "High" } },
        sentiment: { label: "Customer tone", options: { calm: "Calm", upset: "Upset" } },
        personal_data: { label: "Contains personal data", options: { no: "No", yes: "Yes" } },
      },
    },
    order_workflow: {
      title: "Analysing an order",
      lead: "The automation proposes the next step for an order. It does not change the order and does not write to the customer.",
      shows: ["What holds an order", "When a second look is needed", "Why changing an order needs approval"],
      fields: {
        value: { label: "Value", options: { small: "Small", medium: "Medium", large: "Large" } },
        payment: { label: "Payment", options: { paid: "Paid", pending: "Pending", failed: "Failed" } },
        address: { label: "Address", options: { valid: "Valid", unclear: "Unclear" } },
        stock: { label: "Stock", options: { available: "Available", partial: "Partial", none: "None" } },
      },
    },
    inventory_warning: {
      title: "Inventory warning",
      lead: "When stock is low, a supplier request is prepared as a draft. The quantity is a direction, not a number.",
      shows: ["The level of the warning", "The direction of the request", "Why an order to a supplier needs a person"],
      fields: {
        stock: { label: "Stock", options: { ok: "Sufficient", low: "Low", empty: "Empty" } },
        trend: { label: "Sales trend", options: { rising: "Rising", stable: "Stable", falling: "Falling" } },
        lead_time: { label: "Supplier lead time", options: { short: "Short", long: "Long" } },
      },
    },
    crm_automation: {
      title: "CRM automation",
      lead: "An event in the CRM creates a task. Without consent there is no marketing message, only an internal task.",
      shows: ["What creates a task", "How consent is respected", "Why messages are drafts"],
      fields: {
        event: { label: "Event", options: { form_submitted: "Form submitted", quote_opened: "Quotation opened", no_reply_7d: "No reply for 7 days" } },
        segment: { label: "Customer", options: { new: "New", existing: "Existing" } },
        consent: { label: "Marketing consent", options: { yes: "Given", no: "Not given" } },
      },
    },
    quotation_drafting: {
      title: "Drafting a quotation",
      lead: "The structure of a quotation is prepared as a draft. The price and any guarantee are for a person to decide, not the automation.",
      shows: ["The sections of a draft", "What never goes into it", "When questions come first"],
      fields: {
        service: { label: "Service", options: { website: "Business website", store: "Online store", integration: "Integration" } },
        scope: { label: "Clarity of the scope", options: { clear: "Clear", partial: "Partial", vague: "Vague" } },
      },
    },
    human_approval: {
      title: "Human approval before a business action",
      lead: "The platform's policy decides which actions need a person. Prices, orders and sensitive data are critical.",
      shows: ["What is low and what is critical risk", "When a senior review is needed", "Why nothing starts without approval"],
      fields: {
        action: { label: "Proposed action", options: { message: "Send a message", price_change: "Change a price", refund: "Refund a payment", data_change: "Change sensitive data" } },
        amount: { label: "Size", options: { none: "No amount", small: "Small", large: "Large" } },
        reversible: { label: "Can it be undone", options: { yes: "Yes", no: "No" } },
      },
    },
  },
  codes: {
    access_sensitive_data: "Access to sensitive data", action_data_change: "Action: change of data", action_message: "Action: message", action_price_change: "Action: price change", action_refund: "Action: refund",
    address_unclear: "The address is unclear", address_valid: "The address is valid", amount_large: "Large amount", amount_none: "No amount", amount_small: "Small amount",
    approval_critical: "Critical risk", approval_high: "High risk", approval_low: "Low risk, no outside effect",
    assumptions_listed: "Assumptions are listed", band_cold: "Cold", band_hot: "Hot", band_is_a_suggestion: "The rating is a suggestion to a person", band_warm: "Warm",
    budget_high: "High budget", budget_low: "Low budget", budget_mid: "Medium budget", budget_none: "No budget stated", change_price: "Change of price",
    checked: "Input checked: nothing to report", checked_with_flags: "Input checked: something was flagged", consent_no: "No consent", consent_respected: "Consent is respected", consent_yes: "Consent given",
    customer_not_contacted: "The customer is not contacted", decision_is_logged: "The decision is logged", draft_benefits: "Draft of the benefits", draft_headline: "Draft of the headline",
    event_form_submitted: "Event: form submitted", event_no_reply_7d: "Event: no reply for 7 days", event_quote_opened: "Event: quotation opened",
    facts_from_source_only: "Facts from the source only", first_reply_task: "Task: first reply", follow_up_call_task: "Task: a call", gaps_marked_for_review: "Gaps are marked for review",
    generate_draft: "Generating a draft", gentle_reminder_task: "Task: a gentle reminder", human_reads_first: "A person reads first", instruction_like_text: "The note looks like an instruction: it is treated as data and ignored",
    large_order_second_look: "Large order: a second look", lead_time_long: "Long supplier lead time", lead_time_short: "Short supplier lead time", level_critical: "Level: critical", level_warning: "Level: warning",
    link_in_text: "The note contains a link: it is not followed", message_is_a_draft: "The message is a draft", missing_product_facts: "Key product facts are missing: no draft is made", modify_order: "Change of an order", modify_product: "Change of a product",
    need_clear: "Clear need", need_vague: "Vague need", no_alert_needed: "No alert is needed", no_guarantee: "No guarantees", no_marketing_message_without_consent: "No marketing message without consent",
    no_message_to_customer: "No message to the customer", no_order_placed_with_supplier: "No order with the supplier", no_price_in_the_draft: "No price in the draft", no_price_or_promise: "No price or promise", no_promise_to_customer: "No promise to the customer",
    no_reply_sent_to_customer: "No reply sent to the customer", no_unverified_claims: "No unverified claims", not_advice: "Not advice", not_reached: "This step is not reached", nothing_executed: "Nothing is executed", nothing_runs_before_approval: "Nothing starts before approval",
    order_not_changed: "The order is not changed", output_checked: "The output is checked", payment_failed: "Payment failed", payment_paid: "Paid", payment_pending: "Payment pending", personal_data_masked: "Personal data is masked",
    personal_detail_in_text: "The note contains personal details: they are not used", price_left_to_a_person: "The price is left to a person",
    proposal_ask_customer_for_address: "Ask the customer for a valid address", proposal_ask_for_facts: "Ask for the missing facts", proposal_ask_scoping_questions: "Ask questions about the scope", proposal_backorder_options: "Offer options for the missing stock",
    proposal_create_proposal_draft: "Create a draft quotation for review", proposal_draft_purchase_request: "Prepare a draft request to the supplier", proposal_first_reply_task: "Create a task for the first reply", proposal_follow_up_call_task: "Create a task for a call",
    proposal_gentle_reminder_task: "Create a task for a gentle reminder", proposal_hold_and_ask_customer: "Hold the order and ask the customer", proposal_internal_task_only: "An internal task only", proposal_no_action: "No action is needed",
    proposal_nurture_later: "Come back to the enquiry later", proposal_owner_reply_this_week: "A reply from the owner this week", proposal_owner_reply_today: "A reply from the owner today", proposal_ready_to_ship: "The order can be prepared for shipping",
    proposal_route_ticket: "Route the request to the queue", proposal_split_shipment_proposal: "Propose a split shipment", proposal_update_product_draft: "Update a draft of the description", proposal_wait_for_approval: "Wait for approval", proposal_wait_for_payment: "Wait for payment",
    quantity_is_a_direction_not_a_number: "The quantity is a direction, not a number", queue_account_support: "Queue: accounts", queue_exists: "The queue exists", queue_logistics: "Queue: logistics", queue_payments_specialist: "Queue: payments specialist",
    queue_product_team: "Queue: product team", queue_returns_desk: "Queue: returns", reason_recorded: "The reason is recorded", reasons_listed: "The reasons are listed", reorder_increase: "Request: more", reorder_keep: "Request: the same", reorder_reduce: "Request: less",
    reversible_no: "It cannot be undone", reversible_yes: "It can be undone", rule_based: "Plain rules, not a model", rules_applied_as_simulation: "The rules are applied as a simulation", scope_clear: "Clear scope", scope_partial: "Partial scope", scope_too_vague: "The scope is too vague: no draft is made",
    secret_like_text: "The note looks like a secret key or a password: it is ignored", section_assumptions: "Section: assumptions", section_care: "Section: care", section_compatibility: "Section: compatibility", section_deliverables: "Section: what you receive", section_dimensions: "Section: dimensions",
    section_exclusions: "Section: what is not included", section_fit: "Section: fit", section_ingredients_source: "Section: ingredients (from the source)", section_material: "Section: material", section_milestones: "Section: milestones", section_scope: "Section: scope", section_skin_note: "Section: a note on skin",
    section_specifications: "Section: specifications", section_usage: "Section: usage", section_warranty_source: "Section: warranty (from the source)", segment_existing: "Existing customer", segment_new: "New customer", send_message: "Sending a message", senior_reviewer: "A senior review is needed",
    sentiment_calm: "Calm tone", sentiment_upset: "Upset tone", service_integration: "Service: integration", service_store: "Service: online store", service_website: "Service: business website", simulated_data: "Invented data", stock_available: "Available", stock_none: "Out of stock", stock_ok: "Stock is sufficient", stock_partial: "Partial stock",
    timeline_later: "Timeline: later", timeline_quarter: "Timeline: this quarter", timeline_unknown: "Unknown timeline", timeline_urgent: "Urgent timeline", tone_friendly: "Friendly tone", tone_neutral: "Neutral tone", tone_premium: "Premium tone", trend_falling: "Falling sales", trend_rising: "Rising sales", trend_stable: "Stable sales",
    trigger_crm_automation: "An event in the CRM", trigger_human_approval: "A proposed business action", trigger_inventory_warning: "A change in stock", trigger_lead_qualification: "A new enquiry", trigger_order_workflow: "A new order", trigger_product_description: "A product with an old or missing draft", trigger_quotation_drafting: "A request for a quotation", trigger_support_routing: "A new support request",
    unsubscribe_included: "An opt-out from marketing is included", unsubscribe_not_needed_for_service_message: "A service message: not marketing", urgency_high: "High urgency", urgency_low: "Low urgency", urgency_normal: "Normal urgency", value_large: "Large order", value_medium: "Medium order", value_small: "Small order", version_kept_for_review: "The version is kept for review",
  },
};

export const demoTexts: Record<Locale, DemoTexts> = { bg, en };
