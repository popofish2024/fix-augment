import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Fix Augment Extension Test Suite', () => {
	vscode.window.showInformationMessage('Starting Fix Augment tests...');

	test('Extension should be present', () => {
		const extension = vscode.extensions.getExtension('RomyRianata.fix-augment');
		assert.ok(extension, 'Fix Augment extension should be present');
	});

	test('Extension should activate', async () => {
		const extension = vscode.extensions.getExtension('RomyRianata.fix-augment');
		if (extension) {
			await extension.activate();
			assert.ok(extension.isActive, 'Extension should be active');
		}
	});

	test('Commands should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		const fixAugmentCommands = commands.filter(cmd => cmd.startsWith('fix-augment.'));

		assert.ok(fixAugmentCommands.length > 0, 'Fix Augment commands should be registered');
		assert.ok(fixAugmentCommands.includes('fix-augment.enhanceInput'), 'enhanceInput command should be registered');
		assert.ok(fixAugmentCommands.includes('fix-augment.formatOutput'), 'formatOutput command should be registered');
		assert.ok(fixAugmentCommands.includes('fix-augment.enhanceAgent'), 'enhanceAgent command should be registered');
	});
});
