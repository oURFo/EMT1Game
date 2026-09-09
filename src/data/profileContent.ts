import type { CaseTier } from "../game/types";

export type ProfileId =
  | "anaphylaxis"
  | "copd"
  | "pulmonary-edema"
  | "airway-obstruction"
  | "opioid"
  | "seizure"
  | "syncope"
  | "head-trauma"
  | "fracture"
  | "burn"
  | "hypothermia"
  | "drowning"
  | "cardiac-arrest"
  | "gi-bleed"
  | "hyperglycemia"
  | "carbon-monoxide"
  | "pediatric-fever"
  | "pregnancy"
  | "sepsis"
  | "electrical"
  | "chest-trauma"
  | "elderly-fall";

export const PROFILE_TIER: Record<ProfileId, CaseTier> = {
  syncope: "intro",
  fracture: "intro",
  "elderly-fall": "intro",
  "pediatric-fever": "intro",
  copd: "intermediate",
  "pulmonary-edema": "intermediate",
  anaphylaxis: "intermediate",
  seizure: "intermediate",
  burn: "intermediate",
  hyperglycemia: "intermediate",
  "carbon-monoxide": "intermediate",
  hypothermia: "intermediate",
  drowning: "intermediate",
  "gi-bleed": "intermediate",
  pregnancy: "intermediate",
  electrical: "intermediate",
  "airway-obstruction": "advanced",
  opioid: "advanced",
  "head-trauma": "advanced",
  "chest-trauma": "advanced",
  sepsis: "advanced",
  "cardiac-arrest": "advanced",
};

export const PROFILE_SAMPLE: Record<ProfileId, string> = {
  anaphylaxis:
    "S：接觸疑似過敏原後呼吸困難與全身蕁麻疹；A：需確認過敏原與過去過敏史；M：需確認抗組織胺或腎上腺素自動注射器；P：需確認氣喘、過敏性鼻炎；L：進食後約 15 分鐘；E：戶外活動或進食後突然不適。",
  copd:
    "S：慢性咳嗽、喘促，活動後加重；A：長期 COPD，近期可能未規律用藥；M：吸入型支氣管擴張劑、類固醇；P：COPD、可能合併心臟病；L：早餐後活動；E：受涼或感染後逐漸惡化。",
  "pulmonary-edema":
    "S：端坐呼吸、粉紅泡沫痰、無法平躺；A：可能有心衰竭或腎臟病史；M：利尿劑、降血壓藥；P：高血壓、心臟病、洗腎；L：晚餐後；E：數小時內突然呼吸惡化。",
  "airway-obstruction":
    "S：進食或嗆咳後突然無法發聲；A：需確認嗆到物品與時間；M：無特殊；P：需確認氣喘或異物吸入史；L：進食當下；E：目擊嗆咳後迅速惡化。",
  opioid:
    "S：意識下降、呼吸極慢；A：可能使用不明藥物或酒精；M：需確認鎮定安眠藥物；P：物質濫用、憂鬱；L：不詳；E：友人發現倒地。",
  seizure:
    "S：全身抽搐後意識混亂；A：需確認是否為已知癲癇；M：抗癲癇藥；P：癲癇、頭部外傷；L：不詳；E：活動或睡眠中突然發作。",
  syncope:
    "S：短暫失去意識後恢復；A：需確認是否心悸、胸痛；M：降血壓藥、抗心律不整藥；P：心臟病、貧血、脫水；L：久站或排便後；E：突然眼前發黑倒地。",
  "head-trauma":
    "S：頭部外傷後頭痛、嘔吐、意識改變；A：需確認受傷機轉與是否失去意識；M：抗凝血藥需特別詢問；P：高血壓、抗凝血；L：不詳；E：跌倒或車禍後。",
  fracture:
    "S：肢體疼痛、變形、無法負重；A：需確認跌倒高度與機轉；M：止痛藥；P：骨質疏鬆；L：不詳；E：跌倒或撞擊當下。",
  burn:
    "S：接觸熱液、火焰或化學品後燒燙傷；A：需確認受傷時間與環境；M：無特殊；P：氣喘、心臟病；L：不詳；E：烹飪或火災現場。",
  hypothermia:
    "S：長時間暴露後反應遲鈍、寒顫或停止；A：需確認暴露時間與濕 clothing；M：無特殊；P：高齡、酒精；L：不詳；E：登山或寒夜暴露。",
  drowning:
    "S：溺水或接近溺水後呼吸困難；A：需確認水中時間；M：無特殊；P：癲癇、心臟病；L：不詳；E：游泳或翻船事故。",
  "cardiac-arrest":
    "S：突然無反應、無正常呼吸；A：需向目擊者確認倒地時間；M：需確認心臟用藥；P：心臟病、糖尿病；L：不詳；E：活動中或休息時突然倒地。",
  "gi-bleed":
    "S：嘔血、黑便、頭暈；A：需確認出血量與時間；M：抗凝血藥、胃藥；P：消化性潰瘍、肝硬化；L：數日前開始不適；E：嘔吐或排便時惡化。",
  hyperglycemia:
    "S：多渴多尿、嗜睡、深快呼吸；A：需確認糖尿病用藥；M：胰島素或口服降血糖藥；P：糖尿病；L：不詳；E：數日控制不良。",
  "carbon-monoxide":
    "S：頭痛、噁心、多人同時不適；A：需確認燃氣設備與通風；M：無特殊；P：無特殊；L：不詳；E：密閉空間使用燃氣設備。",
  "pediatric-fever":
    "S：高燒、活動力下降或抽搐；A：需向照顧者確認疫苗與用藥；M：退燒藥；P：既往熱性痙攣；L：不詳；E：發燒一日內惡化。",
  pregnancy:
    "S：懷孕中腹痛、陰道出血或近昏厥；A：需確認週數與產檢；M：孕期用藥；P：妊娠、子癲前；L：不詳；E：突然腹痛或出血。",
  sepsis:
    "S：發燒、寒顫、意識改變、低血壓；A：需確認感染來源；M：抗生素；P：糖尿病、免疫抑制；L：不詳；E：感染後數日惡化。",
  electrical:
    "S：觸電後意識改變、燒灼傷；A：需確認是否已斷電；M：無特殊；P：心臟節律器；L：不詳；E：接觸電源或雷擊。",
  "chest-trauma":
    "S：胸部撞擊後胸痛、呼吸困難；A：需確認車禍或跌落高度；M：抗凝血藥；P：心臟病；L：不詳；E：車禍或高處跌落。",
  "elderly-fall":
    "S：跌倒後髖部或頭部疼痛；A：需確認是否服用抗凝血藥；M：抗凝血、降血壓藥；P：高血壓、骨質疏鬆；L：如常；E：如廁或下床時跌倒。",
};
