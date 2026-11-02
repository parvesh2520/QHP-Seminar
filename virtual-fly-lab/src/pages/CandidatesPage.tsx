import { CandidateAnalysis } from '../components/candidates/CandidateAnalysis';

export function CandidatesPage() {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-[1400px]">
        <CandidateAnalysis />
      </div>
    </div>
  );
}
