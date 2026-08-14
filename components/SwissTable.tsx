import { getTeam, teamName } from "@/data/teams";
import type { SwissRow } from "@/lib/types";

/**
 * Swiss standings. W-L counts COMPLETED series only — a half-played Bo3 is not
 * a win, and showing it as one would put a team a round ahead of reality.
 *
 * `state` drives the colour. It stays "active" for everyone until the group
 * stage is actually decided, because the number of Swiss rounds has not been
 * published and guessing it would paint live teams as eliminated. Setting a fate
 * by hand in overrides.json colours a row immediately.
 */
const STATE_STYLE: Record<SwissRow["state"], { text: string; label: string }> = {
  active: { text: "text-[#c9d3dc]", label: "" },
  advanced: { text: "text-[#3fcf8e]", label: "Main Event" },
  elimination_round: { text: "text-[#d8c089]", label: "Elimination round" },
  eliminated: { text: "text-[#6b7785] line-through", label: "Out" },
};

export function SwissTable({ rows }: { rows: SwissRow[] }) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-widest text-[#6b7785]">Group stage standings</h2>

      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-[#6b7785]">
            <th className="w-8 py-1 font-normal">#</th>
            <th className="py-1 font-normal">Team</th>
            <th className="tabular w-10 py-1 text-right font-normal">W</th>
            <th className="tabular w-10 py-1 text-right font-normal">L</th>
            <th className="py-1 pl-3 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const style = STATE_STYLE[row.state];
            const team = getTeam(row.teamId);
            return (
              <tr key={row.teamId} className="border-t border-[#232a33]">
                <td className="tabular py-1.5 text-[#6b7785]">{i + 1}</td>
                <td className={`py-1.5 ${style.text}`}>
                  <span className="flex items-center gap-2">
                    {team && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={team.logo}
                        alt=""
                        width={20}
                        height={20}
                        className="h-5 w-5 object-contain"
                      />
                    )}
                    {teamName(row.teamId)}
                  </span>
                </td>
                <td className="tabular py-1.5 text-right">{row.wins}</td>
                <td className="tabular py-1.5 text-right">{row.losses}</td>
                <td className={`py-1.5 pl-3 text-xs ${style.text}`}>{style.label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
