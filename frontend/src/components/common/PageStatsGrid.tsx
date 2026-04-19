import { StatsCard } from "../page/StatsCard";

type StatItem = {
  title: string;
  value: string | number;
  loading: boolean;
};

interface PageStatsGridProps {
  stats: StatItem[];
}

export function PageStatsGrid({ stats }: PageStatsGridProps) {
  return (
    <div className="grid w-full grid-cols-12 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.title}
          className="col-span-12 sm:col-span-6 lg:col-span-3"
        >
          <StatsCard
            title={stat.title}
            value={stat.value}
            loading={stat.loading}
          />
        </div>
      ))}
    </div>
  );
}
