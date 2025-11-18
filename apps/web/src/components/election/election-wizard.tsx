"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  adjustVoteAction,
  createElectionAction,
  finalizeCountingAction,
  finalizeElectionAction,
  startRunoffAction
} from "@/server/actions/elections";
import {
  electionFormSchema,
  type ElectionFormValues
} from "@/lib/validation/election";
import type { ElectionSnapshot } from "@/lib/types/election";
import { cn } from "@/lib/utils";
import {
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Trophy
} from "lucide-react";

type ViewState = "form" | "counting" | "results" | "final";

const steps = [
  { id: "form", label: "1. Setup" },
  { id: "counting", label: "2. Counting" },
  { id: "results", label: "3. Results" },
  { id: "final", label: "4. End" }
] as const;

export function ElectionWizard() {
  const [snapshot, setSnapshot] = useState<ElectionSnapshot | null>(null);
  const [view, setView] = useState<ViewState>("form");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [votePending, setVotePending] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ElectionFormValues>({
    resolver: zodResolver(electionFormSchema),
    defaultValues: {
      description: "",
      position: "",
      term: "",
      seats: 1,
      candidatesText: ""
    }
  });

  const currentBallot = snapshot?.currentBallot;
  const latestResult = snapshot?.latestResult;
  const totalSeats = snapshot?.election.seats ?? 0;

  const electedCount = useMemo(() => {
    if (!snapshot) {
      return 0;
    }

    return snapshot.candidates.filter(
      (candidate) => candidate.electedBallotNumber !== null
    ).length;
  }, [snapshot]);

  const tieCount = latestResult?.tieCandidateIds.length ?? 0;

  const derivedView: ViewState = useMemo(() => {
    if (!snapshot) {
      return "form";
    }

    if (snapshot.election.status === "finalized") {
      return "final";
    }

    if (view === "results" || view === "final") {
      return view;
    }

    if (snapshot.currentBallot) {
      return "counting";
    }

    if (snapshot.latestResult) {
      return "results";
    }

    return "counting";
  }, [snapshot, view]);

  const handleCreateElection = form.handleSubmit((values) => {
    const names = values.candidatesText
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);

    if (names.length === 0) {
      setFeedback("Please provide at least one candidate name.");
      return;
    }

    if (names.length < values.seats) {
      setFeedback("The number of candidates must be at least the open seats.");
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      try {
        const nextSnapshot = await createElectionAction({
          description: values.description,
          position: values.position,
          term: values.term,
          seats: values.seats,
          candidates: names
        });

        setSnapshot(nextSnapshot);
        setView("counting");
        form.reset();
      } catch (error) {
        setFeedback(
          error instanceof Error
            ? error.message
            : "Unable to create the election."
        );
      }
    });
  });

  const handleVoteChange = (candidateId: string, delta: 1 | -1) => {
    if (!snapshot?.currentBallot) {
      return;
    }

    if (votePending) {
      return;
    }

    const ballotId = snapshot.currentBallot.id;
    setFeedback(null);
    setVotePending(candidateId);

    startTransition(async () => {
      try {
        const result = await adjustVoteAction({
          ballotId,
          candidateId,
          delta
        });

        setSnapshot((prev) => {
          const activeBallot = prev?.currentBallot;
          if (!prev || !activeBallot) {
            return prev;
          }

          const updateVotes = activeBallot.votes.map((vote) =>
            vote.candidateId === result.candidateId
              ? { ...vote, votes: result.votes }
              : vote
          );

          return {
            ...prev,
            ballots: prev.ballots.map((ballot) =>
              ballot.id === activeBallot.id
                ? { ...ballot, votes: updateVotes }
                : ballot
            ),
            currentBallot: { ...activeBallot, votes: updateVotes }
          };
        });
      } catch (error) {
        setFeedback(
          error instanceof Error ? error.message : "Unable to update votes."
        );
      } finally {
        setVotePending(null);
      }
    });
  };

  const handleFinalizeCounting = () => {
    if (!snapshot?.currentBallot) {
      return;
    }

    const ballotId = snapshot.currentBallot.id;
    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await finalizeCountingAction({
          electionId: snapshot.election.id,
          ballotId
        });

        setSnapshot(response.snapshot);
        setView("results");
      } catch (error) {
        setFeedback(
          error instanceof Error
            ? error.message
            : "Failed to finalize counting."
        );
      }
    });
  };

  const handleStartRunoff = () => {
    if (!snapshot) {
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      try {
        const nextSnapshot = await startRunoffAction({
          electionId: snapshot.election.id
        });
        setSnapshot(nextSnapshot);
        setView("counting");
      } catch (error) {
        setFeedback(
          error instanceof Error
            ? error.message
            : "Unable to start a new count."
        );
      }
    });
  };

  const handleFinalizeElection = () => {
    if (!snapshot) {
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      try {
        const nextSnapshot = await finalizeElectionAction({
          electionId: snapshot.election.id
        });
        setSnapshot(nextSnapshot);
        setView("final");
      } catch (error) {
        setFeedback(
          error instanceof Error
            ? error.message
            : "Unable to finalize the election."
        );
      }
    });
  };

  const handleReset = () => {
    setSnapshot(null);
    setView("form");
    setFeedback(null);
    form.reset();
  };

  const winners = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return snapshot.candidates
      .filter((candidate) => candidate.electedBallotNumber !== null)
      .sort(
        (left, right) =>
          (left.electedBallotNumber ?? 0) - (right.electedBallotNumber ?? 0)
      );
  }, [snapshot]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <StepIndicator active={derivedView} />

      {feedback ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {feedback}
        </div>
      ) : null}

      {derivedView === "form" && (
        <section className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <header>
            <h2 className="text-xl font-semibold text-slate-900">
              Create a new election
            </h2>
            <p className="text-sm text-slate-500">
              Describe the election, configure available seats, and list all
              candidates (one per line).
            </p>
          </header>

          <form
            onSubmit={(event) => {
              void handleCreateElection(event);
            }}
            className="grid gap-4"
          >
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Description
              <textarea
                {...form.register("description")}
                className="min-h-[80px] rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Extraordinary Board Elections"
              />
              {form.formState.errors.description ? (
                <span className="text-xs text-red-600">
                  {form.formState.errors.description.message}
                </span>
              ) : null}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Position
                <input
                  {...form.register("position")}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Executive Committee"
                />
                {form.formState.errors.position ? (
                  <span className="text-xs text-red-600">
                    {form.formState.errors.position.message}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Term of office
                <input
                  {...form.register("term")}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="2025 - 2027"
                />
                {form.formState.errors.term ? (
                  <span className="text-xs text-red-600">
                    {form.formState.errors.term.message}
                  </span>
                ) : null}
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Open seats
                <input
                  type="number"
                  min={1}
                  {...form.register("seats", { valueAsNumber: true })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {form.formState.errors.seats ? (
                  <span className="text-xs text-red-600">
                    {form.formState.errors.seats.message}
                  </span>
                ) : null}
              </label>
            </div>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Candidates (one per line)
              <textarea
                {...form.register("candidatesText")}
                className="min-h-[160px] rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={"Jane Doe\nJohn Smith\nAlice Johnson"}
              />
              {form.formState.errors.candidatesText ? (
                <span className="text-xs text-red-600">
                  {form.formState.errors.candidatesText.message}
                </span>
              ) : (
                <span className="text-xs text-slate-500">
                  Tip: use line breaks to separate each candidate name.
                </span>
              )}
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <LoaderIcon />
                    Creating...
                  </span>
                ) : (
                  "Start counting"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  form.reset();
                }}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear
              </button>
            </div>
          </form>
        </section>
      )}

      {snapshot ? (
        <ElectionDetails snapshot={snapshot} />
      ) : null}

      {derivedView === "counting" && currentBallot ? (
        <CountingStep
          ballot={currentBallot}
          votePending={votePending}
          isPending={isPending}
          onVoteChange={handleVoteChange}
          onFinalize={handleFinalizeCounting}
        />
      ) : null}

      {derivedView === "results" && latestResult ? (
        <ResultsStep
          result={latestResult}
          openSeats={latestResult.seatsAvailable}
          tieCount={tieCount}
          seats={totalSeats}
          electedCount={electedCount}
          isPending={isPending}
          onStartRunoff={handleStartRunoff}
          onFinalizeElection={handleFinalizeElection}
        />
      ) : null}

      {derivedView === "final" && snapshot ? (
        <FinalStep winners={winners} onRestart={handleReset} />
      ) : null}
    </div>
  );
}

function StepIndicator({ active }: { active: ViewState }) {
  return (
    <ol className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {steps.map((step, index) => {
        const isActive = step.id === active;
        const passed =
          steps.findIndex((entry) => entry.id === active) > index;

        return (
          <li key={step.id} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold",
                passed && "border-green-500 bg-green-500 text-white",
                isActive && !passed && "border-primary text-primary"
              )}
            >
              {passed ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
            </span>
            <span
              className={cn(
                "font-medium",
                passed && "text-slate-400 line-through",
                isActive && "text-primary"
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <ChevronRight className="h-4 w-4 text-slate-300" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function ElectionDetails({ snapshot }: { snapshot: ElectionSnapshot }) {
  return (
    <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Position
        </p>
        <p className="text-lg font-semibold text-slate-900">
          {snapshot.election.position}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Term of office
        </p>
        <p className="text-lg font-semibold text-slate-900">
          {snapshot.election.term}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <CalendarCheck2 className="h-10 w-10 rounded-full bg-primary/10 p-2 text-primary" />
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Election date
          </p>
          <p className="text-lg font-semibold text-slate-900">
            {new Date(snapshot.election.electionDate).toLocaleDateString()}
          </p>
        </div>
      </div>
    </section>
  );
}

function CountingStep({
  ballot,
  votePending,
  isPending,
  onVoteChange,
  onFinalize
}: {
  ballot: NonNullable<ElectionSnapshot["currentBallot"]>;
  votePending: string | null;
  isPending: boolean;
  onVoteChange: (candidateId: string, delta: 1 | -1) => void;
  onFinalize: () => void;
}) {
  const sortedVotes = [...ballot.votes].sort(
    (left, right) => left.candidate.sortOrder - right.candidate.sortOrder
  );

  return (
    <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Ballot #{ballot.ballotNumber}
            {ballot.type === "runoff" ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                Runoff
              </span>
            ) : null}
          </p>
          <h3 className="text-xl font-semibold text-slate-900">
            Real-time counting
          </h3>
          <p className="text-sm text-slate-500">
            {ballot.seatsAvailable} seat
            {ballot.seatsAvailable > 1 ? "s are" : " is"} open in this round.
          </p>
        </div>
        <button
          onClick={onFinalize}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <LoaderIcon />
              Saving...
            </span>
          ) : (
            "Finalize counting"
          )}
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sortedVotes.map((vote) => (
          <div
            key={vote.candidateId}
            className="rounded-lg border border-slate-200 p-4 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">
              {vote.candidate.name}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onVoteChange(vote.candidateId, -1);
                }}
                disabled={vote.votes === 0 || !!votePending}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[3rem] text-center text-2xl font-semibold text-slate-900">
                {vote.votes}
              </span>
              <button
                type="button"
                onClick={() => {
                  onVoteChange(vote.candidateId, 1);
                }}
                disabled={!!votePending}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResultsStep({
  result,
  openSeats,
  tieCount,
  seats,
  electedCount,
  isPending,
  onStartRunoff,
  onFinalizeElection
}: {
  result: NonNullable<ElectionSnapshot["latestResult"]>;
  openSeats: number;
  tieCount: number;
  seats: number;
  electedCount: number;
  isPending: boolean;
  onStartRunoff: () => void;
  onFinalizeElection: () => void;
}) {
  const canFinalize = tieCount === 0 && electedCount >= seats;

  return (
    <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Ballot #{result.ballotNumber} results
          </p>
          <h3 className="text-xl font-semibold text-slate-900">
            Ranked candidates
          </h3>
          <p className="text-sm text-slate-500">
            Highlighted rows represent secured seats. Ties are marked in amber.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onStartRunoff}
            disabled={tieCount === 0 || isPending}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <LoaderIcon />
                Preparing...
              </span>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                New vote count
              </>
            )}
          </button>
          <button
            onClick={onFinalizeElection}
            disabled={!canFinalize || isPending}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <LoaderIcon />
                Finalizing...
              </span>
            ) : (
              "Finalize election"
            )}
          </button>
        </div>
      </header>

      {tieCount > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {tieCount} candidate{tieCount > 1 ? "s" : ""} tied for{" "}
          {openSeats === 1
            ? "the last seat"
            : `${String(openSeats)} seats`}
          . Start a new count including only the tied names.
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-100">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rank
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Candidate
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Votes
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-sm">
            {result.ranked.map((candidate) => {
              const isWinner = result.winnerIds.includes(candidate.id);
              const inTie = result.tieCandidateIds.includes(candidate.id);

              return (
                <tr
                  key={candidate.id}
                  className={cn(
                    "transition",
                    isWinner && "bg-emerald-50",
                    inTie && "bg-amber-50"
                  )}
                >
                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {candidate.rank}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {candidate.name}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{candidate.votes}</td>
                  <td className="px-4 py-3">
                    {isWinner ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Secured
                      </span>
                    ) : inTie ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        Pending tie
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        Eliminated
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FinalStep({
  winners,
  onRestart
}: {
  winners: ElectionSnapshot["candidates"];
  onRestart: () => void;
}) {
  return (
    <section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Trophy className="h-8 w-8" />
      </div>
      <div>
        <h3 className="text-2xl font-semibold text-slate-900">
          Election finalized
        </h3>
        <p className="text-sm text-slate-500">
          Congratulations to the elected candidates. Their election round is
          recorded below.
        </p>
      </div>
      <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-lg border border-slate-100">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Candidate</th>
              <th className="px-4 py-2 text-left">Ballot number</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {winners.map((candidate) => (
              <tr key={candidate.id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {candidate.name}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  Ballot #{candidate.electedBallotNumber}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={onRestart}
        className="mx-auto inline-flex w-full max-w-xs items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Launch another election
      </button>
    </section>
  );
}

function LoaderIcon() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}

