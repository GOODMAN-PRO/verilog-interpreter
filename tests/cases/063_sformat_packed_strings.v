`timescale 1ns/1ps
module tb;
  reg [8*64-1:0] buffer;
  reg [8*8-1:0] short_text;
  integer count;
  initial begin
    count=-17;
    $sformat(buffer,"count=%0d hex=%h char=%c %%",count,8'haf,8'd81);
    $display("formatted <%0s>",buffer);
    $sformat(buffer,"real=%.2f signed=%5d",2.375,count);
    $display("formatted <%0s>",buffer);
    $sformat(short_text,"abcdefghijk");
    $display("truncate <%s> %h",short_text,short_text);
    $sformat(buffer,"xz=%b/%h",8'bxxzz0011,8'bxxzz0011);
    $display("formatted <%0s>",buffer);
    $sformat(buffer,"line1\nline2\t\"quoted\"\\end");
    $display("escapes <%0s>",buffer);
    $sformat(buffer,"scope=%m");
    $display("formatted <%0s>",buffer);
    $finish;
  end
endmodule
