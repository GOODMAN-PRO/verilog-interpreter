module t;
task automatic r1; input integer n;
  begin if (n > 0) begin r1(n-1); $display("n=%0d", n); end end
endtask
initial r1(2);
endmodule
