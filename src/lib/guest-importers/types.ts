export type ImportedRsvpStatus =
  | "NOT_INVITED"
  | "INVITED"
  | "CONFIRMED"
  | "DECLINED"
  | "MAYBE";

export type GuestSide = "NOIVO" | "NOIVA" | "AMBOS";

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
  // Campos opcionais que só alguns importers preenchem.
  side?: GuestSide | null;
  isVIP?: boolean;
  plusOnesAllowed?: number;
  tableNumber?: string | null;
  dietary?: string | null;
  city?: string | null;
};

export type ImporterId = "wedy" | "internal-csv";

export type RecordRow = Record<string, string>;

export type Importer = {
  id: ImporterId;
  label: string;
  /** Quando true, contatos (phone/email/contactName) da primeira linha
   *  com dados preenchidos viram contato do GuestGroup, e os Guests
   *  individuais ficam sem phone/email próprios. */
  contactsBelongToGroup: boolean;
  /** Decide se a planilha/CSV pertence a este importador. */
  detect(records: RecordRow[], headers: string[]): boolean;
  /** Converte os dicionários cabeçalho→valor em ParsedRow canônico. */
  parseRecords(records: RecordRow[]): ParsedRow[];
};
