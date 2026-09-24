export type Tier = "foundation" | "higher";

export type TierDocs = {
  worksheetUrl: string | null;
  worksheet: string | null;
  markschemeUrl: string | null;
  markscheme: string | null;
};

/** One GCSE topic as imported from virtusacademy.co.uk. */
export type TopicContent = {
  id: string;
  subject: string;
  unit: string;
  unitName: string;
  slug: string;
  title: string;
  url: string;
  category: string;
  subcategory: string;
  boards: string[];
  tiers: { foundation: boolean; higher: boolean };
  intro: string;
  notes: string;
  foundation: TierDocs | null;
  higher: TierDocs | null;
  related: { title: string; url: string }[];
  importedAt: string;
};
