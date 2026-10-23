"""Deterministic demo engine for the automation advisor.

This is NOT AI analysis: it matches keywords in the description against a fixed set of
process patterns and fills pre-written templates (Bulgarian here, English in
`advisor_mock_en.py`) with the visitor's selections. The same input always gives the same
output. The advisor labels it as a demonstration.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any

from app.advisor.prompt import AdvisorPromptInput
from app.advisor.safety import write_approval
from app.advisor.schemas import MonthlyVolume, TeamSize, ToolKey, option_labels
from app.ai import advisor_mock_en as en
from app.ai.advisor_template_base import ProcessPattern
from app.ai.advisor_template_base import approval as _approval
from app.ai.advisor_template_base import opp as _opp
from app.ai.advisor_template_base import risk as _risk
from app.ai.advisor_template_base import step as _step

__all__ = ["GENERAL", "PATTERNS", "ProcessPattern", "build_demo_assessment"]


PATTERNS: list[ProcessPattern] = [
    ProcessPattern(
        key="invoices",
        label="фактуриране и плащания",
        keywords=("фактур", "счетовод", "плащан", "банк", "разход", "касов", "плат"),
        uses_ai=True,
        opportunities=[
            _opp(
                "Автоматично извличане на данни от входящи фактури",
                "Входящите фактури (PDF или снимки) се разпознават, а доставчик, номер, дата и суми се "
                "попълват в чернова за проверка, вместо да се въвеждат ръчно.",
                "ai_assisted",
                "high",
            ),
            _opp(
                "Съпоставяне на плащания с фактури",
                "Банковите движения се сравняват с отворените фактури по правила (номер, сума, контрагент), "
                "а несъответствията се събират в списък за преглед.",
                "rules",
                "medium",
            ),
        ],
        workflow=[
            _step("Събиране на документите", "Фактурите постъпват в една пощенска кутия или папка.", "system"),
            _step(
                "Извличане на данните",
                "AI модел чете документа и подготвя чернова с полетата и степен на увереност за всяко поле.",
                "ai",
            ),
            _step(
                "Проверка на черновата",
                "Служител преглежда полетата с ниска увереност и коригира при нужда.",
                "human",
                True,
            ),
            _step(
                "Запис в счетоводния софтуер",
                "Одобрената фактура се записва в счетоводната система чрез интеграция.",
                "system",
                True,
            ),
            _step("Отчет за несъответствия", "Седмичен списък с неплатени и несъпоставени документи.", "system"),
        ],
        approvals=[
            _approval("Осчетоводяване на фактура", "Грешка в сума или контрагент се отразява в счетоводството."),
            _approval("Всяко нареждане на плащане", "Автоматизацията никога не превежда пари сама."),
        ],
        risks=[
            _risk(
                "Неточно разпознаване на сканирани или нестандартни документи.",
                "Праг на увереност и задължителна човешка проверка под него.",
            ),
        ],
        data_protection=["Фактурите съдържат данни на контрагенти — достъпът се ограничава до счетоводния екип."],
        questions=[
            "В какъв формат получавате фактурите (PDF по имейл, хартия, портал на доставчика)?",
            "Кой счетоводен софтуер използвате и има ли той API или импорт от файл?",
        ],
    ),
    ProcessPattern(
        key="orders",
        label="обработка на поръчки и доставки",
        keywords=("поръч", "доставк", "куриер", "склад", "наличност", "товарител", "пратк", "speedy", "еконт", "econt"),
        uses_ai=False,
        opportunities=[
            _opp(
                "Автоматично създаване на товарителници",
                "След потвърждение на поръчката данните за доставка се подават към куриерската услуга и "
                "номерът на пратката се връща в поръчката.",
                "integration",
                "high",
            ),
            _opp(
                "Синхронизация на наличностите",
                "Наличностите между магазина и склада или ERP се обновяват по график или при събитие, за да "
                "не се продава липсваща стока.",
                "integration",
                "medium",
            ),
        ],
        workflow=[
            _step("Нова поръчка", "Магазинът подава събитие (webhook) при нова или платена поръчка.", "system"),
            _step(
                "Проверка по правила",
                "Проверяват се адрес, наличност и начин на плащане; съмнителните поръчки се маркират.",
                "system",
            ),
            _step(
                "Преглед на маркираните поръчки",
                "Служител решава какво да се случи с поръчките, които не минават проверките.",
                "human",
                True,
            ),
            _step(
                "Създаване на товарителница",
                "Пратката се създава при куриера, след като поръчката е одобрена.",
                "system",
                True,
            ),
            _step(
                "Уведомяване на клиента",
                "Клиентът получава номер за проследяване по шаблон, одобрен предварително от вас.",
                "system",
                True,
            ),
        ],
        approvals=[
            _approval("Отказ, промяна или анулиране на поръчка", "Засяга клиента и плащането."),
            _approval("Текстът на автоматичните съобщения към клиенти", "Шаблоните се одобряват преди пускане."),
        ],
        risks=[
            _risk(
                "Грешни данни за доставка се предават автоматично към куриера.",
                "Валидиране на адреса и ръчен преглед на поръчките с предупреждение.",
            ),
            _risk(
                "Прекъсване на връзката с куриера или склада.",
                "Опашка с повторни опити и известие до отговорен служител.",
            ),
        ],
        data_protection=["Адресите и телефоните на клиенти се предават само на избрания куриер."],
        questions=[
            "С кои куриери работите и използвате ли техния онлайн профил или API?",
            "Къде се води наличността — в магазина, в таблица или в ERP?",
        ],
    ),
    ProcessPattern(
        key="customer_inquiries",
        label="отговаряне на клиентски запитвания",
        keywords=("запитван", "имейл", "въпрос", "рекламац", "връщан", "чат", "viber", "обаждан", "поддръжк", "клиент"),
        uses_ai=True,
        opportunities=[
            _opp(
                "Класифициране и насочване на запитванията",
                "Входящите съобщения се разпределят по тема и спешност, за да стигат до правилния човек.",
                "ai_assisted",
                "high",
            ),
            _opp(
                "Чернови на отговори от вашата база знания",
                "За честите въпроси AI подготвя чернова на отговор въз основа на одобрени от вас текстове; "
                "служител я редактира и изпраща.",
                "ai_assisted",
                "medium",
            ),
        ],
        workflow=[
            _step("Събиране на съобщенията", "Имейл, форма и чат се обединяват в обща опашка.", "system"),
            _step("Класифициране", "AI определя тема, спешност и език на съобщението.", "ai"),
            _step(
                "Чернова на отговор",
                "За стандартните теми AI подготвя чернова с източници от базата знания.",
                "ai",
            ),
            _step("Преглед и изпращане", "Служител проверява, редактира и изпраща отговора.", "human", True),
            _step("Обратна връзка", "Отхвърлените чернови се използват за подобряване на базата знания.", "human"),
        ],
        approvals=[
            _approval("Изпращане на всеки отговор до клиент", "AI не изпраща съобщения от ваше име."),
            _approval("Обещания за отстъпки, връщане на пари или срокове", "Само служител може да ги поема."),
        ],
        risks=[
            _risk(
                "AI предлага неточен или измислен отговор.",
                "Отговори само от одобрена база знания и задължителен човешки преглед.",
            ),
        ],
        data_protection=[
            "Клиентските съобщения се маскират (имена, телефони, имейли), преди да бъдат обработени от AI модел.",
        ],
        questions=[
            "Кои са петте най-чести въпроса, които получавате?",
            "Имате ли писмени правила за връщане, доставка и рекламации?",
        ],
    ),
    ProcessPattern(
        key="reporting",
        label="отчети и обобщаване на данни",
        keywords=("отчет", "справк", "excel", "таблиц", "анализ", "dashboard", "табло", "обобщ"),
        uses_ai=False,
        opportunities=[
            _opp(
                "Автоматични периодични отчети",
                "Данните се събират от източниците по график и отчетът се генерира в един и същ формат, вместо "
                "да се копират ръчно между таблици.",
                "reporting",
                "high",
            ),
            _opp(
                "Табло с ключови показатели",
                "Едно табло с данните, които днес се търсят в няколко системи, обновявано автоматично.",
                "reporting",
                "medium",
            ),
        ],
        workflow=[
            _step("Извличане на данните", "Данните се изтеглят от източниците през API или експорт.", "system"),
            _step("Проверка и почистване", "Дубликати и липсващи стойности се маркират по правила.", "system"),
            _step("Генериране на отчета", "Отчетът се съставя по шаблон и се записва във вътрешна папка.", "system"),
            _step("Преглед на отклоненията", "Отговорен служител преглежда маркираните отклонения.", "human"),
        ],
        approvals=[
            _approval("Промяна на формулите и дефинициите на показателите", "Иначе отчетите стават несравними."),
        ],
        risks=[
            _risk(
                "Различни дефиниции на един и същ показател в различните системи.",
                "Писмено описание на всеки показател преди автоматизацията.",
            ),
        ],
        questions=[
            "Кои отчети изготвяте най-често и кой ги използва?",
            "От колко системи или таблици се събират данните за един отчет?",
        ],
    ),
    ProcessPattern(
        key="catalog",
        label="поддръжка на продуктовия каталог",
        keywords=("продукт", "описан", "снимк", "каталог", "артикул", "атрибут", "превод"),
        uses_ai=True,
        opportunities=[
            _opp(
                "Чернови на продуктови описания",
                "AI подготвя описания и атрибути по ваш стил и техническите данни на продукта; редакторът ги "
                "одобрява преди публикуване.",
                "ai_assisted",
                "high",
            ),
            _opp(
                "Масов импорт от файловете на доставчиците",
                "Файловете на доставчиците се преобразуват автоматично към структурата на магазина.",
                "integration",
                "medium",
            ),
        ],
        workflow=[
            _step("Получаване на данните", "Ценоразписи и спецификации постъпват като файл или през API.", "system"),
            _step("Преобразуване", "Полетата се съпоставят със структурата на магазина по правила.", "system"),
            _step("Чернова на съдържанието", "AI предлага описание и атрибути за новите продукти.", "ai"),
            _step("Редакция и одобрение", "Редактор проверява текстовете и данните.", "human", True),
            _step("Публикуване", "Одобрените продукти се публикуват в магазина.", "system", True),
        ],
        approvals=[
            _approval("Публикуване на продукти и промяна на цени", "Грешна цена или описание засяга клиентите."),
        ],
        risks=[
            _risk(
                "Неточни технически характеристики в генерирания текст.",
                "Генериране само от подадените данни и проверка от редактор.",
            ),
        ],
        questions=["Колко нови продукта добавяте месечно и от колко доставчици?"],
    ),
    ProcessPattern(
        key="bookings",
        label="резервации и графици",
        keywords=("резервац", "график", "календар", "запазван", "смен", "час за"),
        uses_ai=False,
        opportunities=[
            _opp(
                "Онлайн записване с правила за свободните часове",
                "Клиентите избират свободен час, а системата прилага вашите правила за продължителност и почивки.",
                "rules",
                "high",
            ),
            _opp(
                "Автоматични напомняния",
                "Клиентите получават напомняне по одобрен шаблон, което намалява пропуснатите часове.",
                "rules",
                "medium",
            ),
        ],
        workflow=[
            _step("Заявка за час", "Клиентът избира услуга и свободен час.", "system"),
            _step("Проверка на правилата", "Системата проверява графика и конфликтите.", "system"),
            _step("Потвърждение", "При специални случаи служител потвърждава ръчно.", "human", True),
            _step("Напомняне", "Изпраща се напомняне по одобрен шаблон.", "system", True),
        ],
        approvals=[_approval("Промяна или отказ на потвърдена резервация", "Засяга клиента пряко.")],
        risks=[
            _risk(
                "Двойни резервации при ръчни промени извън системата.",
                "Един календар като източник на истината за всички канали.",
            ),
        ],
        questions=["Как приемате резервации днес — по телефон, съобщения или онлайн?"],
    ),
    ProcessPattern(
        key="documents",
        label="въвеждане на данни от документи",
        keywords=("въвежд", "копир", "документ", "pdf", "договор", "сканир", "формуляр", "преписва"),
        uses_ai=True,
        opportunities=[
            _opp(
                "Извличане на данни от документи",
                "Данните от документите се разпознават и попълват в структурирана форма за проверка, вместо да се "
                "преписват ръчно.",
                "ai_assisted",
                "high",
            ),
            _opp(
                "Проверки за пълнота",
                "Правила проверяват дали всички задължителни полета и приложения са налице, преди документът да "
                "продължи напред.",
                "rules",
                "medium",
            ),
        ],
        workflow=[
            _step("Получаване на документа", "Документът постъпва чрез имейл, качване или скенер.", "system"),
            _step("Разпознаване", "AI извлича полетата и отбелязва несигурните стойности.", "ai"),
            _step("Проверка", "Служител потвърждава или коригира несигурните полета.", "human", True),
            _step("Запис", "Потвърдените данни се записват в целевата система.", "system", True),
        ],
        approvals=[_approval("Записване на данните в основната система", "Предотвратява разпространението на грешки.")],
        risks=[
            _risk(
                "Чувствителни данни в документите.",
                "Минимално необходими полета, криптирано съхранение и ограничен достъп.",
            ),
        ],
        data_protection=["Документите се съхраняват само толкова дълго, колкото е нужно за обработката."],
        questions=["Какви видове документи обработвате и колко различни шаблона има?"],
    ),
    ProcessPattern(
        key="sales",
        label="обработка на запитвания за оферти и продажби",
        keywords=("оферт", "продажб", "crm", "лийд", "потенциал", "търг", "проследяван"),
        uses_ai=True,
        opportunities=[
            _opp(
                "Автоматичен запис на запитванията в CRM",
                "Запитванията от сайта, имейл и телефон се записват на едно място с източник и статус.",
                "integration",
                "high",
            ),
            _opp(
                "Чернова на оферта по шаблон",
                "AI попълва шаблон на оферта от описанието на клиента; търговецът преглежда и допълва.",
                "ai_assisted",
                "medium",
            ),
        ],
        workflow=[
            _step("Ново запитване", "Запитването се записва в CRM с източник и тема.", "system"),
            _step("Обобщение", "AI обобщава нуждата на клиента и предлага следваща стъпка.", "ai"),
            _step("Чернова на офертата", "Шаблонът се попълва с данните от запитването.", "ai"),
            _step("Преглед и изпращане", "Търговец проверява условията и изпраща офертата.", "human", True),
            _step("Напомняне за последващ контакт", "Системата напомня на търговеца при липса на отговор.", "system"),
        ],
        approvals=[_approval("Изпращане на оферта и условия към клиент", "Търговските условия са ангажимент.")],
        risks=[
            _risk(
                "Непълна информация в автоматично попълнената оферта.",
                "Задължителни полета и преглед от търговец преди изпращане.",
            ),
        ],
        questions=["Как проследявате статуса на офертите днес?"],
    ),
]

GENERAL = ProcessPattern(
    key="general",
    label="повтаряща се ръчна работа",
    keywords=(),
    uses_ai=False,
    opportunities=[
        _opp(
            "Картографиране и стандартизиране на процеса",
            "Преди автоматизация процесът се описва стъпка по стъпка, за да се видят повтарящите се действия и "
            "местата, където се губи информация.",
            "rules",
            "high",
        ),
        _opp(
            "Автоматизация на прехвърлянето на данни",
            "Данните, които днес се копират ръчно между системи, се прехвърлят автоматично по правила.",
            "integration",
            "medium",
        ),
    ],
    workflow=[
        _step("Начало на процеса", "Събитие или график стартира процеса.", "system"),
        _step("Обработка по правила", "Стандартните случаи се обработват автоматично.", "system"),
        _step("Изключения", "Нестандартните случаи се насочват към служител.", "human", True),
        _step("Резултат и отчет", "Резултатът се записва и се отчита в общ дневник.", "system"),
    ],
    approvals=[_approval("Обработка на изключенията", "Нестандартните случаи изискват човешка преценка.")],
    risks=[
        _risk(
            "Описанието не дава достатъчно информация за конкретните стъпки.",
            "Кратък работен разговор и преглед на реални примери преди решение.",
        ),
    ],
    questions=["Опишете стъпките на процеса от началото до края — кой какво прави и в коя система?"],
)

_TOOL_INTEGRATIONS: dict[ToolKey, tuple[str, str, str]] = {
    ToolKey.SHOPIFY: ("Shopify", "Поръчки, продукти и клиенти чрез Admin API и webhooks.", "read_write"),
    ToolKey.WOOCOMMERCE: ("WooCommerce", "Поръчки и продукти чрез REST API и webhooks.", "read_write"),
    ToolKey.OTHER_ECOMMERCE: ("E-commerce платформа", "Поръчки и продукти, ако платформата има API.", "read_write"),
    ToolKey.SPREADSHEETS: ("Excel / Google Sheets", "Временен източник или изход за отчети.", "read_write"),
    ToolKey.GOOGLE_WORKSPACE: ("Google Workspace", "Gmail, Drive и Calendar като входни канали.", "read"),
    ToolKey.MICROSOFT_365: ("Microsoft 365", "Outlook, SharePoint и OneDrive като входни канали.", "read"),
    ToolKey.EMAIL: ("Имейл", "Входящи съобщения и документи.", "read"),
    ToolKey.CRM: ("CRM", "Запис на контакти, запитвания и статуси.", "read_write"),
    ToolKey.ERP: ("ERP", "Наличности, поръчки и документи.", "read_write"),
    ToolKey.ACCOUNTING: ("Счетоводен софтуер", "Импорт на одобрени документи.", "write"),
    ToolKey.INVOICING: ("Софтуер за фактуриране", "Издаване на фактури след одобрение.", "write"),
    ToolKey.COURIER: ("Куриерски API", "Създаване на пратки и проследяване.", "read_write"),
    ToolKey.PAYMENTS: ("Платежен доставчик", "Само четене на статуса на плащанията.", "read"),
    ToolKey.HELPDESK: ("Система за поддръжка", "Тикети, тагове и чернови на отговори.", "read_write"),
    ToolKey.MESSAGING: ("Viber / WhatsApp / Messenger", "Входящи съобщения чрез официалните бизнес API.", "read"),
}

_BASE_DATA_PROTECTION = [
    "Обработват се само данните, нужни за процеса (минимизиране на данните по GDPR).",
    "Ако се използва външен AI доставчик, нужни са договор за обработка на данни и проверка къде се "
    "обработват данните.",
    "Достъпът на автоматизацията до всяка система е с отделен акаунт и минимални права.",
]
_BASE_RISKS = [
    _risk(
        "Автоматизацията продължава да работи по остарели правила, след като процесът се промени.",
        "Отговорник за процеса и преглед на правилата на всеки няколко месеца.",
    ),
]
_NEXT_STEPS = [
    "Съберете 5–10 реални примера на процеса (без лични данни), включително трудни случаи.",
    "Определете кой в екипа отговаря за процеса и одобрява промените.",
    "Проверете кои от използваните системи имат API или поне импорт и експорт на файлове.",
    "Обсъдете оценката с нас — първо уточняваме обхвата, после предлагаме писмена оферта.",
]


_PHASES: dict[str, list[dict[str, Any]]] = {
    "low": [
        {
            "name": "Уточняване",
            "description": "Преглед на реални примери и описание на правилата.",
            "deliverables": ["Описание на процеса", "Списък с правила и изключения"],
            "indicative_duration": "3–5 работни дни",
        },
        {
            "name": "Пилотна автоматизация",
            "description": "Автоматизация на стандартния случай с ръчна обработка на изключенията.",
            "deliverables": ["Работещ пилот", "Дневник на обработените случаи"],
            "indicative_duration": "1–2 седмици",
        },
        {
            "name": "Въвеждане",
            "description": "Обучение на екипа и наблюдение в реална работа.",
            "deliverables": ["Кратка инструкция", "Отговорник и процедура при грешка"],
            "indicative_duration": "до 1 седмица",
        },
    ],
    "medium": [
        {
            "name": "Анализ на процеса",
            "description": "Картографиране на стъпките, системите и решенията, които изискват човек.",
            "deliverables": ["Карта на процеса", "Списък с интеграции и нужни достъпи"],
            "indicative_duration": "около 1 седмица",
        },
        {
            "name": "Прототип",
            "description": "Прототип върху реални, анонимизирани примери с измерване на точността.",
            "deliverables": ["Прототип", "Резултати от тестовите примери"],
            "indicative_duration": "2–3 седмици",
        },
        {
            "name": "Интеграции и тестове",
            "description": "Свързване със системите, стъпки за одобрение и обработка на грешки.",
            "deliverables": ["Интеграции", "Тестове", "Одитен дневник"],
            "indicative_duration": "2–4 седмици",
        },
        {
            "name": "Пускане и наблюдение",
            "description": "Поетапно пускане и корекции според обратната връзка.",
            "deliverables": ["План за пускане", "Наблюдение и известия"],
            "indicative_duration": "около 2 седмици",
        },
    ],
    "high": [
        {
            "name": "Анализ и картографиране",
            "description": "Подробен анализ на процеса, участниците, данните и изключенията.",
            "deliverables": ["Карта на процеса", "Оценка на данните и рисковете"],
            "indicative_duration": "1–2 седмици",
        },
        {
            "name": "Архитектура и сигурност",
            "description": "Избор на архитектура, права за достъп, съхранение на данни и одит.",
            "deliverables": ["Техническа архитектура", "Модел на правата", "Оценка за GDPR"],
            "indicative_duration": "1–2 седмици",
        },
        {
            "name": "Поетапна разработка",
            "description": "Разработка по етапи, като всеки етап се пуска самостоятелно.",
            "deliverables": ["Интеграции", "Стъпки за одобрение", "Автоматични тестове"],
            "indicative_duration": "4–8 седмици",
        },
        {
            "name": "Паралелна работа и пускане",
            "description": "Новият процес работи паралелно със стария, докато резултатите съвпаднат.",
            "deliverables": ["Сравнение на резултатите", "Финален план за пускане"],
            "indicative_duration": "2–4 седмици",
        },
    ],
}


def _dedupe(items: list[Any], key: str | None = None) -> list[Any]:
    seen: set[str] = set()
    result = []
    for item in items:
        marker = item[key] if key else item
        if marker not in seen:
            seen.add(marker)
            result.append(item)
    return result


_TEXT_BG = {
    "spreadsheet_title": "По-малко ръчно копиране между таблици",
    "spreadsheet_description": (
        "Таблиците, които днес се попълват ръчно, се захранват автоматично от основната система."
    ),
    "storage_system": "Централно хранилище на данни",
    "storage_purpose": "Едно място (база данни или таблица), от което автоматизацията чете и в което записва.",
    "volume_question": "Има ли пикови периоди и колко бързо трябва да се обработва всеки случай?",
    "other_tools_question": "Какви възможности за интеграция имат другите посочени от вас системи?",
    "owner_question": "Кой ще отговаря за одобренията и за преглед на изключенията?",
    "label_joiner": " и ",
    "summary": (
        "Бизнес: {business}; екип: {team}; обем: {volume}. По ключовите думи в описанието процесът е свързан с "
        "{labels}. Вашето описание: „{excerpt}“"
    ),
    "reason_areas": "процесът обхваща повече от една област",
    "reason_writes": "има интеграции със системи, в които се записват бизнес данни",
    "reason_volume": "обемът изисква надеждна обработка на грешки и повторни опити",
    "reason_team": "повече участници означава повече роли и права за достъп",
    "reason_ai": "част от стъпките изискват AI с човешка проверка",
    "reason_no_tools": "няма посочени системи, така че първо трябва да се избере къде ще се пазят данните",
    "reason_default": "процесът е ясно ограничен и използва малко системи",
    "level_low": "Ниска",
    "level_medium": "Средна",
    "level_high": "Висока",
    "complexity": "{level} сложност, защото {detail}.",
}


@dataclass(frozen=True)
class _Templates:
    patterns: dict[str, ProcessPattern]
    general: ProcessPattern
    integrations: dict[ToolKey, tuple[str, str, str]]
    data_protection: list[str]
    risks: list[dict[str, str]]
    next_steps: list[str]
    phases: dict[str, list[dict[str, Any]]]
    text: dict[str, str]


_TEMPLATES = {
    "bg": _Templates(
        patterns={p.key: p for p in PATTERNS},
        general=GENERAL,
        integrations=_TOOL_INTEGRATIONS,
        data_protection=_BASE_DATA_PROTECTION,
        risks=_BASE_RISKS,
        next_steps=_NEXT_STEPS,
        phases=_PHASES,
        text=_TEXT_BG,
    ),
    "en": _Templates(
        patterns=en.PATTERNS,
        general=en.GENERAL,
        integrations=en.TOOL_INTEGRATIONS,
        data_protection=en.BASE_DATA_PROTECTION,
        risks=en.BASE_RISKS,
        next_steps=en.NEXT_STEPS,
        phases=en.PHASES,
        text=en.TEXT,
    ),
}

# Keywords of both languages, so an English description on the Bulgarian page (or the reverse)
# still matches. Pattern order (the tie-breaker) is the Bulgarian list order.
_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    (p.key, tuple(dict.fromkeys(p.keywords + en.PATTERNS[p.key].keywords))) for p in PATTERNS
]


def _match(description: str) -> list[str]:
    """Keys of the (at most two) best-matching patterns; empty when nothing matches."""
    text = description.lower()
    scored = [(sum(k in text for k in keywords), i, key) for i, (key, keywords) in enumerate(_KEYWORDS)]
    hits = sorted((s for s in scored if s[0] > 0), key=lambda s: (-s[0], s[1]))
    return [key for _, _, key in hits[:2]]


def _complexity(data: AdvisorPromptInput, patterns: list[ProcessPattern], text: dict[str, str]) -> dict[str, str]:
    reasons: list[str] = []
    score = 0
    if len(patterns) > 1:
        score += 1
        reasons.append(text["reason_areas"])
    heavy = [t for t in data.tools if t in (ToolKey.ERP, ToolKey.ACCOUNTING, ToolKey.INVOICING, ToolKey.CRM)]
    if heavy:
        score += min(len(heavy), 2)
        reasons.append(text["reason_writes"])
    if data.monthly_volume in (MonthlyVolume.FROM_2000_TO_10000, MonthlyVolume.OVER_10000):
        score += 2 if data.monthly_volume == MonthlyVolume.OVER_10000 else 1
        reasons.append(text["reason_volume"])
    if data.team_size in (TeamSize.FROM_21_TO_50, TeamSize.OVER_50):
        score += 1
        reasons.append(text["reason_team"])
    if any(p.uses_ai for p in patterns):
        score += 1
        reasons.append(text["reason_ai"])
    if not data.tools or data.tools == (ToolKey.NONE,):
        reasons.append(text["reason_no_tools"])
    level = "low" if score <= 1 else "medium" if score <= 3 else "high"
    detail = "; ".join(reasons) if reasons else text["reason_default"]
    return {"level": level, "rationale": text["complexity"].format(level=text[f"level_{level}"], detail=detail)}


def build_demo_assessment(data: AdvisorPromptInput) -> dict[str, Any]:
    tpl = _TEMPLATES.get(data.locale, _TEMPLATES["bg"])
    text = tpl.text
    patterns = [tpl.patterns[key] for key in _match(data.process_description)] or [tpl.general]
    primary = patterns[0]

    opportunities = [o for p in patterns for o in p.opportunities]
    if ToolKey.SPREADSHEETS in data.tools and primary.key != "reporting":
        opportunities.append(
            _opp(text["spreadsheet_title"], text["spreadsheet_description"], "integration", "medium")
        )

    integrations = [
        {"system": s, "purpose": purpose, "access": access}
        for tool in data.tools
        if (entry := tpl.integrations.get(tool)) is not None
        for s, purpose, access in [entry]
    ]
    if not integrations:
        integrations = [
            {"system": text["storage_system"], "purpose": text["storage_purpose"], "access": "read_write"}
        ]

    approvals = _dedupe([a for p in patterns for a in p.approvals], "decision")[:5]
    if any(i["access"] != "read" for i in integrations):
        approvals.append(write_approval(data.locale).model_dump())

    questions = [q for p in patterns for q in p.questions]
    if data.monthly_volume in (MonthlyVolume.FROM_2000_TO_10000, MonthlyVolume.OVER_10000):
        questions.append(text["volume_question"])
    if data.other_tools:
        questions.append(text["other_tools_question"])
    questions.append(text["owner_question"])

    labels = option_labels(data.locale)
    excerpt = " ".join(data.process_description.split())[:220].rstrip()
    summary = text["summary"].format(
        business=labels.business[data.business_type],
        team=labels.team[data.team_size],
        volume=labels.volume[data.monthly_volume],
        labels=text["label_joiner"].join(p.label for p in patterns),
        excerpt=excerpt + ("…" if len(data.process_description) > 220 else ""),
    )

    complexity = _complexity(data, patterns, text)
    # Deep copy: callers may mutate the result, and the templates above are shared module state.
    return copy.deepcopy({
        "problem_summary": summary,
        "opportunities": _dedupe(opportunities, "title")[:6],
        "proposed_workflow": primary.workflow,
        "integrations": integrations[:8],
        "human_approvals": approvals,
        "data_protection": _dedupe(tpl.data_protection + [d for p in patterns for d in p.data_protection])[:6],
        "risks": _dedupe([r for p in patterns for r in p.risks] + tpl.risks, "risk")[:6],
        "complexity": complexity,
        "phases": tpl.phases[complexity["level"]],
        "clarification_questions": _dedupe(questions)[:8],
        "next_steps": tpl.next_steps,
    })
