module t;
  task automatic tk;
    begin : tb
      #5 $display("%0t a", $time);
    end
  endtask
  initial begin tk; $display("%0t done", $time); end
  initial #2 disable tk.tb;
endmodule
