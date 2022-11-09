import { StringBuilder } from '@microsoft/tsdoc';
/**
 * A utility for writing indented text.
 *
 * @remarks
 *
 * Note that the indentation is inserted at the last possible opportunity.
 * For example, this code...
 *
 * ```ts
 *   writer.write('begin\n');
 *   writer.increaseIndent();
 *   writer.write('one\ntwo\n');
 *   writer.decreaseIndent();
 *   writer.increaseIndent();
 *   writer.decreaseIndent();
 *   writer.write('end');
 * ```
 *
 * ...would produce this output:
 *
 * ```
 *   begin
 *     one
 *     two
 *   end
 * ```
 */
export declare class IndentedWriter {
    /**
     * The text characters used to create one level of indentation.
     * Two spaces by default.
     */
    defaultIndentPrefix: string;
    private readonly _builder;
    private _latestChunk;
    private _previousChunk;
    private _atStartOfLine;
    private readonly _indentStack;
    private _indentText;
    private _beforeStack;
    private _isWritingBeforeStack;
    constructor(builder?: StringBuilder);
    /**
     * Retrieves the output that was built so far.
     */
    getText(): string;
    toString(): string;
    /**
     * Increases the indentation.  Normally the indentation is two spaces,
     * however an arbitrary prefix can optional be specified.  (For example,
     * the prefix could be "// " to indent and comment simultaneously.)
     * Each call to IndentedWriter.increaseIndent() must be followed by a
     * corresponding call to IndentedWriter.decreaseIndent().
     *
     * @param  indentPrefix
     */
    increaseIndent(indentPrefix?: string): void;
    /**
     * Decreases the indentation, reverting the effect of the corresponding call
     * to IndentedWriter.increaseIndent().
     */
    decreaseIndent(): void;
    /**
     * A shorthand for ensuring that increaseIndent()/decreaseIndent() occur
     * in pairs.
     *
     * @param  scope
     * @param  indentPrefix
     */
    indentScope(scope: () => void, indentPrefix?: string): void;
    /**
     * Adds a newline if the file pointer is not already at the start of the line (or start of the stream).
     */
    ensureNewLine(): void;
    /**
     * Adds up to two newlines to ensure that there is a blank line above the current line.
     */
    ensureSkippedLine(): void;
    /**
     * Returns the last character that was written, or an empty string if no characters have been written yet.
     */
    peekLastCharacter(): string;
    /**
     * Returns the second to last character that was written, or an empty string if less than one characters
     * have been written yet.
     */
    peekSecondLastCharacter(): string;
    /**
     * Writes `before` and `after` messages if and only if `mayWrite` writes anything.
     *
     * If `mayWrite` writes "CONTENT", this method will write "<before>CONTENT<after>".
     * If `mayWrite` writes nothing, this method will write nothing.
     *
     * @param  before
     * @param  after
     * @param  mayWrite
     */
    writeTentative(before: string, after: string, mayWrite: () => void): void;
    /**
     * Writes some text to the internal string buffer, applying indentation according
     * to the current indentation level.  If the string contains multiple newlines,
     * each line will be indented separately.
     *
     * @param  message
     */
    write(message: string): void;
    /**
     * A shorthand for writing an optional message, followed by a newline.
     * Indentation is applied following the semantics of IndentedWriter.write().
     *
     * @param  message
     */
    writeLine(message?: string): void;
    /**
     * Writes a string that does not contain any newline characters.
     *
     * @param  message
     */
    private _writeLinePart;
    private _writeNewLine;
    private _write;
    /**
     * Writes all messages in our before stack, processing them in FIFO order. This stack is
     * populated by the `writeTentative` method.
     */
    private _writeBeforeStack;
    private _updateIndentText;
}
