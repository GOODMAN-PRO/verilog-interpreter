module top;
task automatic t(input set_it);
  reg a[0:0];
  if(set_it) a[0]=1; else $display("%b",a[0]);
endtask
initial begin t(1); t(0); end
endmodule
