import { CommunicationsTabs } from "./_components/communications-tabs";

export default function CommunicationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <CommunicationsTabs />
      {children}
    </div>
  );
}
