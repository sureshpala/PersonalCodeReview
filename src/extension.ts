// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as vscode from 'vscode';
const {ChatOllama}  = require ('@langchain/ollama');
const { StringOutputParser } = require("@langchain/core/output_parsers");
const {ChatPromptTemplate} = require('@langchain/core/prompts');

import simpleGit from 'simple-git';
import * as tmp from 'tmp';

import { window } from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "PersonalCodeReview" is now active!');

	// Progress notification with option to cancel
	const showProgressNotification = vscode.commands.registerCommand('PersonalCodeReview.showProgress', () => {

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Getting inputs from LLM...",
			cancellable: true
		}, (progress, token) => {

			token.onCancellationRequested(() => {
				console.log("User canceled the long running operation");
			});

			progress.report({ increment: 0 });

			setTimeout(() => {
				progress.report({ increment: 10, message: "Getting inputs..." });
			}, 10000);

			setTimeout(() => {
				progress.report({ increment: 40, message: "Getting inputs...waittng to hear from LLM..." });
			}, 20000);

			setTimeout(() => {
				progress.report({ increment: 50, message: "Getting inputs...waittng to hear from LLM...almost there..." });
			}, 50000);

			const p = new Promise<void>(resolve => {
				setTimeout(() => {
					resolve();
				}, 50000);
			});

			return p;
		});
	});	
	context.subscriptions.push(showProgressNotification);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('PersonalCodeReview', async () => {

		const userResponse = await window.showInputBox({
			placeHolder: 'Provide details in the same order - GitHubRepoURL~GitHubPersonalToken~FeatureBranchName~MainBranchName'

		});

		const splitvalues = userResponse.split('~');
		

		const GitHubRepoURL = splitvalues[0];
		const GitHubPersonalToken = splitvalues[0];
		const FeatureBranchName = splitvalues[2];
		const MainBranchName = splitvalues[3];

		const model = new ChatOllama({
			model:"llama3",
			temperature:0,
		}
		)

		vscode.window.showInformationMessage('Getting changes from Git...');
		//const diff = await get_diff_from_repo_changes("https://github.com/sureshpala/demo","abcd","newfeature","main");
		const diff = await get_diff_from_repo_changes(GitHubRepoURL,GitHubPersonalToken,FeatureBranchName,MainBranchName);
		console.log(diff);

		//vscode.window.showInformationMessage('Getting inputs from LLM...');
		vscode.commands.executeCommand('PersonalCodeReview.showProgress');

		const RAG_TEMPLATE = "You are an expert java developer known for expertise in best practices and code reviews. You have to do/make a code review on a diff file (where issues are detected) on changes done in code. 		Summarize changes for each file and each method using few short sentences. Check if code is conforming to coding standards, OWASP guidelines, exception handling and memory handling. 		Suggest fixes using best code examples. The code to be reviewed are : {diff}";
		const rag_prompt = ChatPromptTemplate.fromTemplate(RAG_TEMPLATE);
		const chain = rag_prompt.pipe(model).pipe(new StringOutputParser());

		const result1 = await chain.invoke({ diff: diff });
		vscode.window.showInformationMessage('Creating review comments document...');
		vscode.workspace.openTextDocument({
			content: result1,
			language: "txt"
		}).then(newDocument => {
			vscode.window.showTextDocument(newDocument);
		});

		vscode.window.showInformationMessage('execution done!!!');
	});

	context.subscriptions.push(disposable);
}

async function get_diff_from_repo_changes(repoUrl: string, accessToken: string, topicBranchName: string, baseBranchName: string): Promise<string> {
    return new Promise((resolve, reject) => {
        tmp.dir(async (err, tmpdirname, cleanupCallback) => {
            if (err) {
                reject(err);
                return;
            }

            const git = simpleGit(tmpdirname);
            const env = { ...process.env, GIT_ASKPASS: accessToken };

            try {
				// Set the environment variable for the current process
				process.env.GIT_ASKPASS = accessToken;
                await git.clone(repoUrl, tmpdirname);

                const topicBranchRef = `origin/${topicBranchName}`;
                let baseBranchRef = `origin/${baseBranchName}`;

                if (!baseBranchName) {
                    const detachedHeadCommitHash = (await git.revparse(['HEAD'])).trim();
                    baseBranchRef = detachedHeadCommitHash;
                }

                await git.fetch('origin', topicBranchName);

                const diffContent = await git.diff([
                    `${baseBranchRef}...${topicBranchRef}`,
                    '--ignore-blank-lines',
                    '--ignore-space-at-eol'
                ]);

                cleanupCallback();
                resolve(diffContent);
            } catch (error) {
                cleanupCallback();
                reject(error);
            }
        });
    });
}
// This method is called when your extension is deactivated
export function deactivate() {}