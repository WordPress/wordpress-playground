import { splitShellCommand } from '../lib/split-shell-command';

describe('splitShellCommand', () => {
	it('Should split a shell command into an array', () => {
		const command =
			'wp post create --post_title="Test post" --post_excerpt="Some content"';
		const result = splitShellCommand(command);
		expect(result).toEqual([
			'wp',
			'post',
			'create',
			'--post_title=Test post',
			'--post_excerpt=Some content',
		]);
	});

	it('Should treat multiple spaces as a single space', () => {
		const command = 'ls    --wordpress   --playground --is-great';
		const result = splitShellCommand(command);
		expect(result).toEqual([
			'ls',
			'--wordpress',
			'--playground',
			'--is-great',
		]);
	});

	it('Should treat quoted segments as a single arg', () => {
		const command = 'ls    --wordpress="This is nice"  more args';
		const result = splitShellCommand(command);
		expect(result).toEqual([
			'ls',
			'--wordpress=This is nice',
			'more',
			'args',
		]);
	});

	it('Should treat single quotes inside doubly quoted segments as a part of the segment', () => {
		const command = 'ls    --wordpress="This \'is\' nice"  more args';
		const result = splitShellCommand(command);
		expect(result).toEqual([
			'ls',
			"--wordpress=This 'is' nice",
			'more',
			'args',
		]);
	});

	it('Should treat escaped double quotes inside doubly quoted segments as a single arg', () => {
		const command = 'ls    --wordpress="This \\"is\\" nice"  more args';
		const result = splitShellCommand(command);
		expect(result).toEqual([
			'ls',
			'--wordpress=This "is" nice',
			'more',
			'args',
		]);
	});

	it('Should allow mixing single and double quotes', () => {
		const command = 'ls    --wordpress="This "\'is\'" nice"  more args';
		const result = splitShellCommand(command);
		expect(result).toEqual([
			'ls',
			'--wordpress=This is nice',
			'more',
			'args',
		]);
	});

	it('Should allow mixing unquoted data and double quotes', () => {
		const command = 'ls    --wordpress="This "is" nice"  more args';
		const result = splitShellCommand(command);
		expect(result).toEqual([
			'ls',
			'--wordpress=This is nice',
			'more',
			'args',
		]);
	});

	it('Should preserve empty quoted arguments', () => {
		const command = 'mail "" --';
		const result = splitShellCommand(command);
		expect(result).toEqual(['mail', '', '--']);
	});

	it('Should preserve an empty argument between options', () => {
		const command = 'sendmail -f "" -t';
		const result = splitShellCommand(command);
		expect(result).toEqual(['sendmail', '-f', '', '-t']);
	});

	it('Should preserve whitespace inside quoted arguments', () => {
		const command = 'printf " leading and trailing "';
		const result = splitShellCommand(command);
		expect(result).toEqual(['printf', ' leading and trailing ']);
	});
});
