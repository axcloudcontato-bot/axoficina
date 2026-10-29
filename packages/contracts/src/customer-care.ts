export const CARE_SERVICE_KEYS = ['PERIODIC_REVIEW', 'OIL_CHANGE', 'BRAKES', 'BRAKE_FLUID', 'TIRES', 'AIR_FILTER', 'CABIN_FILTER', 'COOLING', 'BATTERY', 'WIPERS', 'BELTS', 'SPARK_PLUGS'] as const;
export type CareServiceKey = (typeof CARE_SERVICE_KEYS)[number];
export const CARE_CAMPAIGN_KEYS = ['BIRTHDAY', ...CARE_SERVICE_KEYS] as const;
export type CareCampaignKey = (typeof CARE_CAMPAIGN_KEYS)[number];
export type CareChannel = 'WHATSAPP' | 'EMAIL';
export type CareDeliveryStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'UNKNOWN' | 'SKIPPED';

export interface CareCampaign {
  key: CareCampaignKey;
  name: string;
  emoji: string;
  description: string;
  enabled: boolean;
  intervalMonths: number;
  intervalKm: number | null;
  leadDays: number;
  message: string;
}

// These are configurable invitations to an inspection, never a diagnosis or
// a universal replacement schedule. The vehicle manufacturer's manual wins.
export const DEFAULT_CARE_CAMPAIGNS: CareCampaign[] = [
  { key: 'BIRTHDAY', name: 'Aniversário', emoji: '🎂', description: 'Um carinho no dia do cliente, sem oferta forçada.', enabled: true, intervalMonths: 12, intervalKm: null, leadDays: 0, message: '🎂 Feliz aniversário, {cliente}! Que seu novo ciclo tenha saúde, boas companhias e caminhos felizes. Toda a equipe da {oficina} deseja um dia especial para você! 💛 Conte com a gente para cuidar de você e do seu carro em cada nova viagem. 🚗✨' },
  { key: 'PERIODIC_REVIEW', name: 'Revisão periódica', emoji: '🛡️', description: 'Retorno preventivo para conferir os principais sistemas.', enabled: true, intervalMonths: 6, intervalKm: 10000, leadDays: 7, message: '🛡️ Uma pausa para revisar hoje pode trazer mais tranquilidade amanhã. Vamos conferir os principais cuidados do seu {veiculo}? Nossa equipe prepara a revisão conforme o manual e o uso do seu carro.' },
  { key: 'OIL_CHANGE', name: 'Óleo e filtro do motor', emoji: '🛢️', description: 'Conferir prazo, especificação e condições de uso.', enabled: true, intervalMonths: 6, intervalKm: 10000, leadDays: 7, message: '🛢️ O cuidado com o motor começa nos detalhes. Está chegando o retorno programado para conferir o óleo e o filtro do seu {veiculo}. Vamos verificar o prazo e a especificação do fabricante juntos? 🔧' },
  { key: 'BRAKES', name: 'Pastilhas, discos e freios', emoji: '🛑', description: 'Inspeção do desgaste; troca somente após avaliação.', enabled: true, intervalMonths: 6, intervalKm: 10000, leadDays: 7, message: '🛑 Sua segurança merece atenção em cada parada. Vamos inspecionar pastilhas, discos e o sistema de freios do seu {veiculo}? Só indicamos a troca quando a avaliação mostrar necessidade. 💛' },
  { key: 'BRAKE_FLUID', name: 'Fluido de freio', emoji: '💧', description: 'Conferir condição e prazo do manual.', enabled: true, intervalMonths: 24, intervalKm: null, leadDays: 14, message: '💧 O fluido de freio também precisa de cuidado, mesmo quando o carro roda pouco. Vamos conferir a condição e o prazo recomendado para o seu {veiculo}? Segurança se cuida por inteiro. 🛡️' },
  { key: 'TIRES', name: 'Pneus, alinhamento e balanceamento', emoji: '🛞', description: 'Avaliar desgaste, pressão e necessidade de ajustes.', enabled: true, intervalMonths: 6, intervalKm: 10000, leadDays: 7, message: '🛞 Pneus bem cuidados ajudam o carro a seguir com mais estabilidade. Vamos conferir desgaste, pressão e a necessidade de alinhamento, balanceamento ou rodízio no seu {veiculo}? 🚗' },
  { key: 'AIR_FILTER', name: 'Filtro de ar do motor', emoji: '🌬️', description: 'Inspecionar conforme uso, poeira e manual.', enabled: true, intervalMonths: 12, intervalKm: 10000, leadDays: 7, message: '🌬️ Seu motor também precisa respirar bem. Vamos verificar o filtro de ar do seu {veiculo} e conferir se ele está adequado para a sua rotina? Um cuidado simples que faz parte da boa manutenção. 🔧' },
  { key: 'CABIN_FILTER', name: 'Filtro de cabine e climatização', emoji: '🍃', description: 'Cuidar do conforto de quem viaja no carro.', enabled: true, intervalMonths: 12, intervalKm: 15000, leadDays: 7, message: '🍃 Cuidar do carro também é cuidar de quem vai dentro dele. Vamos conferir o filtro de cabine e a climatização do seu {veiculo}? Mais conforto para os seus caminhos. 💛' },
  { key: 'COOLING', name: 'Sistema de arrefecimento', emoji: '🌡️', description: 'Inspecionar nível, mangueiras, vazamentos e fluido.', enabled: true, intervalMonths: 12, intervalKm: 20000, leadDays: 7, message: '🌡️ Vamos dar atenção ao arrefecimento do seu {veiculo}? Nossa equipe confere nível, mangueiras, possíveis vazamentos e o prazo do fluido conforme o manual. Cuidado preventivo para rodar com tranquilidade. 🚗' },
  { key: 'BATTERY', name: 'Bateria e sistema de carga', emoji: '🔋', description: 'Teste de condição; sem troca por idade presumida.', enabled: true, intervalMonths: 12, intervalKm: null, leadDays: 7, message: '🔋 Um teste de bateria e do sistema de carga ajuda a planejar os próximos cuidados do seu {veiculo}. Vamos conferir como está tudo? A troca só entra na conversa se o diagnóstico indicar. 🔎' },
  { key: 'WIPERS', name: 'Palhetas e visibilidade', emoji: '🌧️', description: 'Conferir limpeza do para-brisa e iluminação.', enabled: true, intervalMonths: 12, intervalKm: null, leadDays: 7, message: '🌧️ Enxergar bem faz parte de viajar com segurança. Vamos conferir palhetas, esguichos e iluminação do seu {veiculo}? Queremos você preparado para os dias de sol e de chuva. 💛' },
  { key: 'BELTS', name: 'Inspeção de correias', emoji: '⚙️', description: 'Conferir o plano específico do motor, sem prazo universal de troca.', enabled: true, intervalMonths: 12, intervalKm: 20000, leadDays: 14, message: '⚙️ Cada motor tem seu próprio plano de cuidado. Vamos conferir as correias do seu {veiculo} e consultar o prazo específico do fabricante? Assim você se programa com informação e tranquilidade. 🔎' },
  { key: 'SPARK_PLUGS', name: 'Ignição e velas', emoji: '⚡', description: 'Inspeção de funcionamento e prazo do fabricante.', enabled: true, intervalMonths: 12, intervalKm: 20000, leadDays: 7, message: '⚡ Vamos conferir o funcionamento da ignição e o plano das velas do seu {veiculo}? Avaliamos as condições e a recomendação do fabricante antes de indicar qualquer troca. 🔧💛' },
];

export interface CareSettings {
  enabled: boolean;
  channel: CareChannel;
  timeZone: string;
  sendHour: number;
  weekdaysOnly: boolean;
  minGapDays: number;
  dailyLimit: number;
  campaigns: CareCampaign[];
}
export const DEFAULT_CARE_SETTINGS: CareSettings = { enabled: false, channel: 'WHATSAPP', timeZone: 'America/Sao_Paulo', sendHour: 9, weekdaysOnly: true, minGapDays: 7, dailyLimit: 50, campaigns: DEFAULT_CARE_CAMPAIGNS };
export interface UpdateCareSettingsRequest extends CareSettings {}
export interface RecordCareServiceRequest { vehicleId: string; serviceKey: CareServiceKey; completedAt: string; mileage?: number; intervalMonths?: number; intervalKm?: number | null }
export interface CarePlanResponse { id: string; customerId: string; customerName: string; vehicleId: string; vehicleName: string; plate: string; serviceKey: CareServiceKey; serviceName: string; completedAt: string; mileage?: number; dueAt: string; dueMileage?: number; intervalMonths: number; intervalKm: number | null }
export interface CareDeliveryResponse { id: string; customerName: string; campaignNames: string[]; channel: CareChannel; status: CareDeliveryStatus; message: string; reason?: string; scheduledAt: string; sentAt?: string }
export interface CareDashboardResponse { settings: CareSettings; channels: { whatsapp: boolean; email: boolean }; stats: { optedIn: number; birthdaysThisMonth: number; dueThisMonth: number; sentThisMonth: number; pending: number; failed: number }; plans: CarePlanResponse[]; deliveries: CareDeliveryResponse[]; totalPlans: number; totalDeliveries: number }
export interface CareForecastItem { vehicleId: string; vehicleName: string; plate: string; serviceKey: CareServiceKey; serviceName: string; dueAt: string; late: boolean }
export interface CareForecastCustomer { customerId: string; customerName: string; kind: 'MAINTENANCE' | 'BIRTHDAY'; items: CareForecastItem[] }
export interface CareForecastDay { date: string; customers: CareForecastCustomer[] }
export interface CareForecastResponse { enabled: boolean; today: string; horizonDays: number; dailyLimit: number; withoutConsent: number; days: CareForecastDay[] }
export interface CarePreviewRequest{ campaignKey: CareCampaignKey; customerId?: string; vehicleId?: string; message?: string }
export interface CarePreviewResponse { message: string; subject: string }
