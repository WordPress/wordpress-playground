# Source: https://stackoverflow.com/questions/33245195/how-to-replace-string-in-a-file-with-perl-in-script-not-in-command-line
# This script is used to replace strings in files and exit with a non-zero status if the string is not found.
use strict;
use warnings;
use autodie;

sub rewrite_file {
    my $file = shift;

    # You can still read from $in after the unlink, the underlying
    # data in $file will remain until the filehandle is closed.
    # The unlink ensures $in and $out will point at different data.
    open my $in, "<", $file;
    unlink $file;

    # This creates a new file with the same name but points at
    # different data.
    open my $out, ">", $file;

    return ($in, $out);
}

my($in, $out) = rewrite_file($ARGV[2], $ARGV[2]);

my $pattern = $ARGV[0];
my $substitution = $ARGV[1];

my $matched = 0;
# Read from $in, write to $out as normal.
while(my $line = <$in>) {
    my $updated = $line;
    $updated =~ s/$pattern/$substitution/g;
    if($updated ne $line) {
        $matched = 1;
    }
    print $out $updated;
}

# Exit with a non-zero status if no matches were found
if(!$matched) {
    exit 1;
}
