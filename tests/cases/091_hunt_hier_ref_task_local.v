module t;
task tk; reg [3:0] loc; begin loc = 7; end endtask
initial begin tk; $display("%0d %0d", tk.loc, t.tk.loc); end
endmodule
