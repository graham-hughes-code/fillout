import express, { Request, Response } from "express";
import {
  QuestionType,
  ResponseType,
  FilterClauseType,
  ResponseFiltersType,
} from "./types";

const app = express();
const port = process.env.PORT || 3000;

const filter_check = {
  equals: (filter: FilterClauseType, response: QuestionType) => {
    return filter.value === response.value;
  },
  does_not_equal: (filter: FilterClauseType, response: QuestionType) => {
    return filter.value !== response.value;
  },
  greater_than: (filter: FilterClauseType, response: QuestionType) => {
    return filter.value < response.value;
  },
  less_than: (filter: FilterClauseType, response: QuestionType) => {
    return filter.value > response.value;
  },
};

const filter_response = (
  responses: ResponseType[],
  filters: ResponseFiltersType
): ResponseType[] => {
  return responses.filter((response) => {
    for (const q in response.questions as QuestionType[]) {
      for (const f in filters as ResponseFiltersType) {
        if (response.questions[q].id === filters[f].id) {
          if (
            !filter_check[filters[f].condition](
              filters[f],
              response.questions[q]
            )
          ) {
            return false;
          }
        }
      }
    }
    return response;
  });
};

app.get(
  "/api/forms/:formId/submissions",
  async (req: Request, res: Response) => {
    const auth_token = req.header("Authorization");
    if (!auth_token) {
      return res.status(403).json({ message: "auth-token missing" });
    }
    const { formId } = req.params;
    const query_params: any = req.query;

    const filters: ResponseFiltersType | undefined = query_params.filters
      ? JSON.parse(query_params.filters)
      : undefined;
    delete query_params.filters;

    const limit = query_params.limit ? query_params.limit : 150;

    let response: any = {};

    try {
      let fillout_response = await fetch(
        `https://api.fillout.com/v1/api/forms/${formId}/submissions` +
          "?" +
          new URLSearchParams(query_params).toString(),
        {
          headers: { Authorization: auth_token },
        }
      );
      const fillout_response_json = await fillout_response.json();
      if (!fillout_response.ok) {
        return res.status(fillout_response.status).json(fillout_response_json);
      }
      response = fillout_response_json;
    } catch (error) {
      return res.status(500).json({ message: "server error" });
    }

    if (filters) {
      const api_response_filtered = filter_response(
        response.responses,
        filters
      );
      response = {
        ...response,
        responses: api_response_filtered,
        totalResponses: response.totalResponses - api_response_filtered.length,
        pageCount:
          (response.totalResponses - api_response_filtered.length) / limit,
      };
    }

    return res.send(response);
  }
);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
