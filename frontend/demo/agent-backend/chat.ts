import { evaluate } from './engine.ts';
import { insuranceCatalog } from '../insurance-data/catalog.ts';

export type AppPage = 'Overview' | 'My vehicle' | 'Payment options' | 'Service centers' | 'Insurance';
export type ChatContext = {
  id: string;
  mileage: number;
  budget: number;
  estimate: number;
  symptoms: boolean;
  page: AppPage;
};
export type ChatReply = {
  message: string;
  action?: { label: string; page: AppPage };
  source?: { label: string; href: string };
};
type Topic = 'safety' | 'insurance' | 'payments' | 'service' | 'vehicle' | 'centers' | 'about';
const pages: AppPage[] = ['Overview', 'My vehicle', 'Payment options', 'Service centers', 'Insurance'];
const money = (cents: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0,
}).format(cents / 100);

function topicFor(text: string): Topic | undefined {
  if (/\b(unsafe|smoke|smoking|burning|emergency|brakes? (?:are |is )?(?:fail|failed|failing)|can.?t stop|cannot stop|safety|symptoms?|squeal\w*|grind\w*)\b/.test(text)) return 'safety';
  if (/\b(insurance|insur\w*|cover\w*|protection|policy|quotes?|deduct\w*|liability|geico|progressive|state\s*farm|warranty|warranties|gap|toyotacare|tire.*wheel|key replacement|lease wear)\b/.test(text)) return 'insurance';
  if (/\b(pay\w*|budgets?|afford\w*|financ\w*|installments?|fees?|interest|spread|costs?|prices?|expensive|cheapest|cheaper|prepaid|recommend\w*)\b/.test(text)) return 'payments';
  if (/\b(dealers?|centers?|centres?|locations?|book\w*|appointments?|handoff|near\w*|austin)\b/.test(text)) return 'centers';
  if (/\b(services?|inspections?|brakes?|tires?|maintenance|weeks?|due|repair\w*|estimates?)\b/.test(text)) return 'service';
  if (/\b(cars?|vehicles?|miles?|mileage|odometer|driv\w*|history|rav4|camry|corolla|maria|james|aisha)\b/.test(text)) return 'vehicle';
  if (/\b(hello|hi|hey|thanks|help|features?|app|work|demo|who are you|what can you)\b/.test(text)) return 'about';
}

export function answerChat(input: unknown): ChatReply {
  if (!input || typeof input !== 'object') throw new Error('A message and vehicle context are required.');
  const { message, context, history = [] } = input as Record<string, unknown>;
  if (typeof message !== 'string' || !message.trim() || message.length > 600) {
    throw new Error('Write a question between 1 and 600 characters.');
  }
  if (!context || typeof context !== 'object') throw new Error('Vehicle context is required.');
  const scenario = context as ChatContext;
  if (typeof scenario.symptoms !== 'boolean' || !pages.includes(scenario.page)) throw new Error('Invalid app context.');
  if (!Array.isArray(history) || history.length > 6 || history.some(item =>
    !item || typeof item !== 'object' || item.role !== 'user' || typeof item.content !== 'string' || item.content.length > 600,
  )) throw new Error('Invalid conversation history.');

  // Recalculate from the same engine as the dashboard so amounts never drift.
  const result = evaluate(scenario.id, scenario.mileage, scenario.budget, scenario.estimate, scenario.symptoms);
  const profile = result.profile;
  const question = message.trim().toLowerCase().replace(/[’']/g, '');
  const followUp = /^(why|how (much|so)|what about|tell me more|and\b|which one|is (it|that)|does (it|that)|can i|what does that)/.test(question);
  const previousTopic = [...history].reverse().map(item => topicFor(item.content.toLowerCase())).find(Boolean);
  const currentPageTopic: Record<AppPage, Topic> = {
    Overview: 'about', 'My vehicle': 'vehicle', 'Payment options': 'payments', 'Service centers': 'centers', Insurance: 'insurance',
  };
  const topic = topicFor(question) ?? (followUp ? previousTopic ?? currentPageTopic[scenario.page] : 'about');

  if (topic === 'safety' || (scenario.symptoms && (topic === 'service' || topic === 'payments'))) {
    return {
      message: 'Your safety comes first. The app routes reported safety symptoms to prompt professional assessment. If your vehicle feels unsafe, stop driving and seek roadside assistance. A chat cannot diagnose the cause or confirm that the car is safe to drive.\n\nOpen My vehicle to review the scenario and prepare a service handoff. Payment preferences should not delay an assessment.',
      action: { label: 'Review my vehicle', page: 'My vehicle' },
    };
  }

  if (topic === 'insurance') {
    const productMatchers: [string, RegExp][] = [
      ['tire-platinum', /tire.*platinum|wheel.*platinum/], ['tire-gold', /tire.*wheel|wheel.*gold|road.hazard/],
      ['key', /\bkeys?\b/], ['gap', /\bgap\b|total.loss/], ['lease-wear', /lease.*wear|excess.*wear/],
      ['maintenance', /toyotacare|prepaid|maintenance/], ['vsa', /warrant|\bvsa\b|mechanical|service agreement/],
    ];
    const productId = productMatchers.find(([, pattern]) => pattern.test(question))?.[0];
    const product = insuranceCatalog.toyotaProducts.find(item => item.id === productId);
    if (product) return {
      message: `${product.name}: ${product.summary}\n\nLimits to know: ${product.exclusions.join(' ')}\n\n${product.eligibility} This guide does not establish that you have an active plan. The uploaded summary is not a contract; your agreement controls.`,
      action: { label: 'Explore protection', page: 'Insurance' },
      source: { label: `Read source · pp. ${product.pages.join(', ')}`, href: `${insuranceCatalog.toyotaSource.url}#page=${product.pages[0]}` },
    };
    if (/quotes?|cheapest|cheaper|compar|premium|geico|progressive|state\s*farm/.test(question)) return {
      message: 'In Insurance, you can enter two or three quotes from GEICO, Progressive, and State Farm. Add each total term premium, its term (1, 6, or 12 months), and the coverage level. The app annualizes the amounts you enter.\n\nIt only ranks them when selected limits and deductibles match and you confirm the same drivers, vehicle, state, dates, fees, and other coverages. It does not retrieve live quotes or recommend an insurer.',
      action: { label: 'Compare my quotes', page: 'Insurance' },
    };
    return {
      message: 'The Insurance section has two parts: a Toyota protection guide with seven products, and a comparison tool for auto insurance quotes you collect.\n\nToyota protection addresses specific maintenance, repair, or financial gaps. It is separate from liability, collision, and comprehensive auto insurance. The guide does not prove that your vehicle has coverage, and no insurer premiums are prefilled. Ask me about GAP, Tire & Wheel, key replacement, maintenance, or service agreements.',
      action: { label: 'Explore insurance', page: 'Insurance' },
    };
  }

  if (topic === 'payments') {
    const [pay, spread, plan] = result.options;
    const selected = result.options.find(option => option.id === result.recommended);
    return {
      message: `For ${profile.name}’s ${profile.vehicle}, the current service estimate is ${money(result.cost)} and the monthly service budget is ${money(scenario.budget * 100)}.\n\nPay at service: ${money(pay.total)} once, with no financing fee.\nSpread the cost: ${spread.schedule.map(money).join(' + ')} across six months, including a ${money(spread.fee)} fixed fee. Total: ${money(spread.total)}.\nPrepaid care: ${plan.eligible ? `${money(plan.total)} for the modeled routine service; confirm real plan terms and eligibility.` : 'not eligible for this modeled wear-item service.'}\n\n${selected ? `The demo currently suggests “${selected.title}.” ${result.explanation}` : result.explanation} These are synthetic illustrations, not credit offers.`,
      action: { label: 'View payment options', page: 'Payment options' },
    };
  }

  if (topic === 'service') return {
    message: `${profile.name}’s ${profile.vehicle} is showing ${profile.service.toLowerCase()} in about ${result.weeks} weeks at ${scenario.mileage.toLocaleString()} miles. Your current scenario estimate is ${money(result.cost)}; the profile’s illustrative range is ${money(profile.low)}–${money(profile.high)}.\n\n${profile.history}. Missing records do not establish wear or a missed service. The timing is a mileage-based demo estimate, not a diagnosis. A professional inspection confirms the work and actual price. Use “Adjust scenario” to explore different mileage, budget, and estimates.`,
    action: { label: 'See my vehicle', page: 'My vehicle' },
  };

  if (topic === 'vehicle') return {
    message: `You’re viewing ${profile.name}’s ${profile.vehicle} (${profile.trim}).\n\nOdometer: ${scenario.mileage.toLocaleString()} miles.\nMonthly driving: ${profile.monthlyMiles.toLocaleString()} miles.\nMonthly service budget: ${money(scenario.budget * 100)}.\nUpcoming item: ${profile.service}.\n\n${profile.history}. All three personas are synthetic. Use the garage cards or the persona selector to switch between the RAV4, Camry, and Corolla.`,
    action: { label: 'Open my vehicle', page: 'My vehicle' },
  };

  if (topic === 'centers') return {
    message: 'The Service centers section includes North Austin and South Austin demo locations. They are fictional fixtures; their addresses, hours, and availability are not verified listings.\n\nChoose a location, then prepare a service summary with your vehicle, mileage, service estimate, and selected payment option. This creates a demo handoff. It does not book an appointment or submit a credit application. Use the real Toyota dealer finder linked there to contact a dealer.',
    action: { label: 'View service centers', page: 'Service centers' },
  };

  return {
    message: 'I’m your Heads Up app guide. I can explain the selected demo vehicle, upcoming service, payment math, Toyota protection products, quote comparison, and service handoff.\n\nTry “Why is this payment option suggested?”, “When is my service due?”, or “What does GAP cover?” My answers use this app’s demo data. I cannot access live quotes, diagnose a car, or contact a human agent.',
    action: { label: 'Back to overview', page: 'Overview' },
  };
}
