import { listLeads } from "@/lib/admin";
import LocalTime from "@/components/LocalTime";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await listLeads();

  return (
    <main className="p-8">
      <div className="mb-7 flex items-baseline gap-4">
        <h1 className="font-serif text-[30px] tracking-[-0.02em]">Leads</h1>
        <span className="text-[13px] text-faint">
          {leads.length} collected
        </span>
      </div>

      {leads.length === 0 ? (
        <p className="max-w-[420px] text-[13.5px] leading-relaxed text-faint">
          A lead is written the moment a conversation has a name, an email, a
          concern, and an experience level. Phone is optional and never chased.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[12px] border hairline">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b hairline bg-paper-2">
                {["Name", "Email", "Concern", "Experience", "Phone", "Channel", "Emailed", "When"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-[10.5px] font-medium uppercase tracking-[0.12em] text-faint"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b hairline last:border-0">
                  <td className="px-4 py-3.5 text-[13px]">
                    {[l.firstName, l.lastName].filter(Boolean).join(" ")}
                  </td>
                  <td className="px-4 py-3.5 text-[13px]">
                    <a
                      href={`mailto:${l.email}`}
                      className="underline decoration-black/20 underline-offset-2"
                    >
                      {l.email}
                    </a>
                  </td>
                  <td className="max-w-[220px] px-4 py-3.5 text-[13px] text-muted">
                    {l.description}
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-muted">
                    {l.experience ?? "—"}
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-muted">
                    {l.phone ?? (
                      <span className="italic text-faint/70">not given</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-muted">
                    {l.channel}
                  </td>
                  <td className="px-4 py-3.5 text-[12px]">
                    {l.notifiedAt ? (
                      <span className="text-sage-deep">sent</span>
                    ) : (
                      <span className="text-[#c9a961]">pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-faint">
                    <LocalTime iso={l.createdAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
