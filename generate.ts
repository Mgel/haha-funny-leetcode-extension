import { Storage } from "@plasmohq/storage"

// TODO: Determine if this could be refactored in some meaningful way
// Get Problem List from leetcode graphql API
const getProblemListFromLeetCodeAPI = async (storage: Storage, difficulty: string) => {
    try {
      const query = `
        query problemsetQuestionList {
          problemsetQuestionList: questionList(
            categorySlug: ""
            limit: -1
            skip: 0
            filters: {
              ${
                difficulty && difficulty !== "all"
                  ? "difficulty: " + difficulty
                  : ""
              }
            }
          ) {
            questions: data {
              acRate
              difficulty
              freqBar
              frontendQuestionId: questionFrontendId
              isFavor
              paidOnly: isPaidOnly
              status
              title
              titleSlug
              topicTags {
                name
                id
                slug
              }
              hasSolution
              hasVideoSolution
            }
          }
        }
      `
  
      const body = {
        query
      }
  
      const response = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json"
        }
      })
  
      const responseData = await response.json()
      await storage.set("permissionsEnabled", true)
      return responseData.data.problemsetQuestionList.questions
    } catch (error) {
      console.log(error.toString())
      if (
        error.message.includes("NetworkError") ||
        error.message.includes("CORS") ||
        error.message === "Network response was not ok"
      ) {
        console.log("CORS error detected.")
        await storage.set("permissionsEnabled", false)
      }
      return undefined
    }
  }
  
async function getLeetCodeApiProblem(storage: Storage,difficulty: string) : Promise<{url: string; name: string}> {
    await storage.set("loading", true);

    // TODO: Optionally allow inclusion of paid problems
    const problems = (await getProblemListFromLeetCodeAPI(storage, difficulty))
        .filter((problem) => !problem.isPaidOnly);
    const randomIndex = Math.floor(Math.random() * problems.length);
    const problem = problems[randomIndex];
    const problemUrl = `https://leetcode.com/problems/${problem.title.replaceAll(" ", "-").toLowerCase()}/`;
    await storage.set("loading", false);

    return Promise.resolve({ url: problemUrl, name: problem.title });
}

const problemSetURLs = {
    allNeetcode: "leetcode-problems/allProblems.json",
    NeetCode150: "leetcode-problems/neetCode150Problems.json",
    Blind75: "leetcode-problems/blind75Problems.json"
};

async function getProblemFromProblemSet(problemSet: string, difficulty: string, includePremium: boolean) {
    const res = await fetch(chrome.runtime.getURL(problemSetURLs[problemSet]));
    let problems = await res.json();
    problems = problems
        .filter((problem) => {
            return (includePremium || !problem.isPremium) &&
            (difficulty == "all" || problem.difficulty.toLowerCase() === difficulty.toLowerCase())
        });

    const randomIndex = Math.floor(Math.random() * problems.length);
    const problem = problems[randomIndex];

    return Promise.resolve({ url: problem.href, name: problem.text });
}

export async function generateProblem(storage: Storage) : Promise<{url: string; name: string}> {
    try{
        const problemSet = (await storage.get("problemSets")) ?? "all";
        const difficulty = (await storage.get("difficulty")) ?? "all";
        const includePremium = Boolean(await storage.get("includePremium")) ?? false;
        
        return problemSet === "all"
            ? Promise.resolve(await getLeetCodeApiProblem(storage, difficulty))
            : Promise.resolve(await getProblemFromProblemSet(problemSet, difficulty, includePremium));
    } catch (error) {
        console.error("Error generating random problem", error)
        return Promise.reject(error);
    } finally {
        await storage.set("loading", false);
    }
}