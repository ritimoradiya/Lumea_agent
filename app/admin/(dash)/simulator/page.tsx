import Simulator from "@/components/Simulator";

export default function SimulatorPage() {
  return (
    <main className="p-8">
      <h1 className="mb-1 font-serif text-[30px] tracking-[-0.02em]">
        Message simulator
      </h1>
      <p className="mb-9 text-[13.5px] text-faint">
        The texting experience, without a phone number.
      </p>
      <Simulator />
    </main>
  );
}
