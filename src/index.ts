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
    // checking auth exists
    const auth_token = req.header("Authorization");
    if (!auth_token) {
      return res.status(403).json({ message: "auth-token missing" });
    }

    // pulling out needed params
    const { formId } = req.params;
    const query_params: any = req.query;

    let filters: ResponseFiltersType | string | undefined = query_params.filters
      ? query_params.filters
      : undefined;
    delete query_params.filters;
    try {
      filters = filters ? JSON.parse(filters as string) : undefined;
    } catch {
      return res.status(400).json({
        status: 400,
        error: "Bad Request",
        message: "filters param was not valid json.",
      });
    }

    const offset: number = query_params.offset ? query_params.offset : 0;
    delete query_params.offset;
    if (isNaN(Number(offset))) {
      return res.status(400).json({
        status: 400,
        error: "Bad Request",
        message: "offset param needs to be a number.",
      });
    }
    const limit: number = query_params.limit ? query_params.limit : 150;
    delete query_params.limit;
    if (isNaN(Number(limit))) {
      return res.status(400).json({
        status: 400,
        error: "Bad Request",
        message: "limit param needs to be a number.",
      });
    }
    if (limit < 0 || limit > 150) {
      return res.status(400).json({
        status: 400,
        error: "Bad Request",
        message: "limit param needs to be between 0 and 150.",
      });
    }

    // pull data from from Fillout api
    let response: any = null;

    try {
      const page_size = 150;
      let last_reponse_len = 1;
      let page_offset = 0;

      while (last_reponse_len != 0) {
        let fillout_response = await fetch(
          `https://api.fillout.com/v1/api/forms/${formId}/submissions` +
            "?" +
            new URLSearchParams({
              offset: page_offset,
              limit: page_size,
              ...query_params,
            }).toString(),
          {
            headers: { Authorization: auth_token },
          }
        );
        const fillout_response_json = await fillout_response.json();
        if (!fillout_response.ok) {
          return res
            .status(fillout_response.status)
            .json(fillout_response_json);
        }

        last_reponse_len = fillout_response_json.responses;

        if (!response) {
          response = fillout_response_json;
        } else if (last_reponse_len > 0) {
          response.responses.push(fillout_response_json.responses);
        }

        page_offset += page_size;
      }
    } catch (error) {
      return res.status(500).json({ status: 500, error: "server error" });
    }

    // filter responses
    if (typeof filters == "object") {
      const api_response_filtered = filter_response(
        response.responses,
        filters
      );
      response = {
        ...response,
        responses: api_response_filtered,
      };
    }

    // add back pagination
    response = {
      ...response,
      totalResponses: response.responses.length,
      pageCount: Math.ceil(response.responses.length / limit),
    };

    response.responses = response.responses.slice(offset, offset + limit);

    return res.send(response);
  }
);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
