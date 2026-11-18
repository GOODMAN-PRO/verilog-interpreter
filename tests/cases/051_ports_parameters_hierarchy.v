`timescale 1ns/1ps
module port_unit #(parameter W=4, BIAS=1)
  (input [W-1:0] a, input enable, output [W-1:0] y, output flag);
  reg [W-1:0] sig;
  assign y = enable ? a + BIAS : sig;
  assign flag = enable;
  initial sig = 0;
  task load;
    input [W-1:0] value;
    begin sig = value; end
  endtask
endmodule
module tb;
  reg [3:0] a;
  reg enable;
  wire [3:0] p, n, floating;
  wire pf, nf;
  port_unit #(4, 3) pos(a, enable, p, pf);
  port_unit #(.BIAS(5), .W(4)) dut(.y(n), .a(a), .enable(enable), .flag(nf));
  port_unit open_ports(.a(a), .enable(), .y(floating), .flag());
  initial begin
    a = 6; enable = 1;
    #1 $display("ports p=%h n=%h flags=%b%b open=%b", p, n, pf, nf, floating);
    tb.dut.load(9);
    pos.load(2);
    enable = 0;
    #1 $display("hier p=%h n=%h sig=%h", p, n, tb.dut.sig);
    tb.dut.sig = 12;
    #1 $display("hier-write n=%h", n);
    $finish;
  end
endmodule
