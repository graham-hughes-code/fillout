export type QuestionType = {
  id: string;
  name: string;
  type: string;
  value: number | string;
};

export type ResponseType = {
  questions: QuestionType[];
  submissionId: string;
  submissionTime: string;
};

export type FilterClauseType = {
  id: string;
  condition: "equals" | "does_not_equal" | "greater_than" | "less_than";
  value: number | string;
};

export type ResponseFiltersType = FilterClauseType[];
