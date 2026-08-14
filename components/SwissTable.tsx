import { getTeam, teamName } from "@/data/teams";
import type { SwissRow } from "@/lib/types";

/**
 * Swiss standings. W-L counts COMPLETED series only — a half-played Bo3 is not
 * a win, and showing it as one would put a team a round ahead of reality.
 *
 * `state` drives the colour, and stays "active" for all 16 until every team has
 * played all 5 Swiss rounds. Once it resolves, the fate is DERIVED from the W-L
 * sort alone and marked provisional: the official cut also breaks ties on
 * Buchholz and game win %, so ranks either side of 3rd/4th and 13th/14th can
 * move. Provisional rows get a hairline accent only. Setting a fate by hand in
 * overrides.json is authoritative and renders at full strength.
 */
const STATE_STYLE: Record<SwissRow["state"], { text: string; label: string; accent: string }> = {
  active: { text: "text-[#c9d3dc]", label: "", accent: "transparent" },
  advanced: { text: "text-[#3fcf8e]", label: "Main Event", accent: "#3fcf8e" },
  elimination_round: { text: "text-[#d8c089]", label: "Elimination round", accent: "#d8c089" },
  eliminated: { text: "text-[#6b7785]", label: "Out", accent: "#e4432f" },
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
            // A derived fate gets a hairline accent and nothing more. Never a
            // filled background — that would read as settled, and the boundary
            // between 3rd/4th and 13th/14th turns on tiebreaks we do not compute.
            const provisional = row.provisional === true;
            return (
              <tr key={row.teamId} className="border-t border-[#232a33]">
                <td
                  className="tabular py-1.5 text-[#6b7785]"
                  style={{ boxShadow: `inset 2px 0 0 0 ${style.accent}` }}
                >
                  <span className="pl-2">{i + 1}</span>
                </td>
                <td className={`py-1.5 ${style.text}`}>
                  <span className="flex items-center gap-2">
                    {team && team.logo && (
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
                <td className={`py-1.5 pl-3 text-xs ${provisional ? "text-[#6b7785]" : style.text}`}>
                  {style.label}
                  {provisional && style.label && <span className="ml-1 opacity-70">(provisional)</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
