`timescale 1ns/1ps
module tb;
  reg [7:0] v;
  reg signed [7:0] s;
  initial begin
    v=8'ha5; s=-3;
    $display(v,s);
    $displayb(v,s);
    $displayh(v,s);
    $displayo(v,s);
    $write("write:"); $write(v); $write("|"); $write(s); $write("\n");
    $writeb("b:",v,"|",s,"\n");
    $writeh("h:",v,"|",s,"\n");
    $writeo("o:",v,"|",s,"\n");
    v=8'bx1z0_zzxx;
    $displayb("unknown:",v);
    $displayh("unknown:",v);
    $displayo("unknown:",v);
    $write("no-newline");
    #1 $write("-continued\n");
    $finish;
  end
endmodule
