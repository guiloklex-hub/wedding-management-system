export type ImportedRsvpStatus =
  | "NOT_INVITED"
  | "INVITED"
  | "CONFIRMED"
  | "DECLINED"
  | "MAYBE";

export type ParsedRow = {
  name: string;
  groupName: string | null;
  phone: string | null;
  email: string | null;
  rsvpStatus: ImportedRsvpStatus;
  rsvpStatusRaw: string | null;
  tags: string[];
  isChild: boolean;
  age: number | null;
  pin: string | null;
  rawSource: Record<string, string>;
};

export type ImporterId = "wedy";

export type Importer = {
  id: ImporterId;
  label: string;
  detect(buf: Buffer): Promise<boolean>;
  parse(buf: Buffer): Promise<ParsedRow[]>;
};
